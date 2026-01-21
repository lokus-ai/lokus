use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanCard {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub assignee: Option<String>,
    pub priority: String,
    pub due_date: Option<String>,
    pub linked_notes: Vec<String>,
    pub checklist: Vec<ChecklistItem>,
    pub created: String,
    pub modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistItem {
    pub text: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanColumn {
    pub name: String,
    pub order: i32,
    pub cards: Vec<KanbanCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanBoard {
    pub version: String,
    pub name: String,
    pub columns: HashMap<String, KanbanColumn>,
    pub settings: BoardSettings,
    pub metadata: BoardMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardSettings {
    #[serde(default)]
    pub card_template: HashMap<String, serde_json::Value>,
    #[serde(default)]
    pub automations: Vec<String>,
    #[serde(default)]
    pub custom_fields: Vec<String>,
}

impl Default for BoardSettings {
    fn default() -> Self {
        Self {
            card_template: HashMap::new(),
            automations: Vec::new(),
            custom_fields: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardMetadata {
    pub created: String,
    pub modified: String,
    pub created_with: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardInfo {
    pub name: String,
    pub path: String,
    pub card_count: usize,
    pub column_count: usize,
    pub modified: String,
}

impl KanbanCard {
    pub fn new(title: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description: None,
            tags: Vec::new(),
            assignee: None,
            priority: String::from("normal"),
            due_date: None,
            linked_notes: Vec::new(),
            checklist: Vec::new(),
            created: now.clone(),
            modified: now,
        }
    }
}

impl KanbanBoard {
    pub fn new(name: String, columns: Vec<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let mut column_map = HashMap::new();

        for (index, col_name) in columns.iter().enumerate() {
            column_map.insert(
                col_name.to_lowercase().replace(" ", "-"),
                KanbanColumn {
                    name: col_name.clone(),
                    order: index as i32,
                    cards: Vec::new(),
                },
            );
        }

        Self {
            version: String::from("1.0.0"),
            name,
            columns: column_map,
            settings: BoardSettings::default(),
            metadata: BoardMetadata {
                created: now.clone(),
                modified: now,
                created_with: String::from("Lokus"),
            },
        }
    }

    pub fn add_card(&mut self, column_id: &str, card: KanbanCard) -> Result<(), String> {
        if let Some(column) = self.columns.get_mut(column_id) {
            column.cards.push(card);
            self.metadata.modified = chrono::Utc::now().to_rfc3339();
            Ok(())
        } else {
            Err(format!("Column '{}' not found", column_id))
        }
    }

    pub fn move_card(&mut self, card_id: &str, from_col: &str, to_col: &str) -> Result<(), String> {
        // Find and remove card from source column
        let card = if let Some(from_column) = self.columns.get_mut(from_col) {
            let pos = from_column.cards.iter().position(|c| c.id == card_id)
                .ok_or_else(|| format!("Card '{}' not found in column '{}'", card_id, from_col))?;
            from_column.cards.remove(pos)
        } else {
            return Err(format!("Source column '{}' not found", from_col));
        };

        // Add card to destination column
        if let Some(to_column) = self.columns.get_mut(to_col) {
            to_column.cards.push(card);
            self.metadata.modified = chrono::Utc::now().to_rfc3339();
            Ok(())
        } else {
            Err(format!("Destination column '{}' not found", to_col))
        }
    }

    pub fn update_card(&mut self, card_id: &str, updates: KanbanCard) -> Result<KanbanCard, String> {
        for column in self.columns.values_mut() {
            if let Some(card) = column.cards.iter_mut().find(|c| c.id == card_id) {
                *card = updates.clone();
                card.modified = chrono::Utc::now().to_rfc3339();
                self.metadata.modified = card.modified.clone();
                return Ok(card.clone());
            }
        }
        Err(format!("Card '{}' not found in any column", card_id))
    }

    pub fn delete_card(&mut self, card_id: &str) -> Result<(), String> {
        for column in self.columns.values_mut() {
            if let Some(pos) = column.cards.iter().position(|c| c.id == card_id) {
                column.cards.remove(pos);
                self.metadata.modified = chrono::Utc::now().to_rfc3339();
                return Ok(());
            }
        }
        Err(format!("Card '{}' not found in any column", card_id))
    }

    pub fn get_total_card_count(&self) -> usize {
        self.columns.values().map(|col| col.cards.len()).sum()
    }
}

// File I/O operations
pub async fn load_board_from_file(file_path: &Path) -> Result<KanbanBoard, String> {
    let content = tokio::fs::read_to_string(file_path)
        .await
        .map_err(|e| format!("Failed to read board file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse board JSON: {}", e))
}

pub async fn save_board_to_file(file_path: &Path, board: &KanbanBoard) -> Result<(), String> {
    let content = serde_json::to_string_pretty(board)
        .map_err(|e| format!("Failed to serialize board: {}", e))?;

    tokio::fs::write(file_path, content)
        .await
        .map_err(|e| format!("Failed to write board file: {}", e))
}

fn scan_directory_for_boards<'a>(
    dir_path: &'a Path,
    boards: &'a mut Vec<BoardInfo>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), String>> + Send + 'a>> {
    Box::pin(async move {
        let mut entries = match tokio::fs::read_dir(dir_path).await {
            Ok(e) => e,
            Err(_) => return Ok(()), // Skip directories we can't read
        };

        while let Some(entry) = entries.next_entry().await.map_err(|e| format!("Failed to read directory entry: {}", e))? {
            let path = entry.path();

            if path.is_file() {
                if path.extension().and_then(|s| s.to_str()) == Some("kanban") {
                    if let Ok(board) = load_board_from_file(&path).await {
                        // Use filename (without extension) as the display name
                        let display_name = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or(&board.name)
                            .to_string();
                        boards.push(BoardInfo {
                            name: display_name,
                            path: path.to_string_lossy().to_string(),
                            card_count: board.get_total_card_count(),
                            column_count: board.columns.len(),
                            modified: board.metadata.modified.clone(),
                        });
                    }
                }
            } else if path.is_dir() {
                // Recursively scan subdirectories
                let _ = scan_directory_for_boards(&path, boards).await;
            }
        }

        Ok(())
    })
}

pub async fn list_boards_in_workspace(workspace_path: &Path) -> Result<Vec<BoardInfo>, String> {
    let mut boards = Vec::new();
    scan_directory_for_boards(workspace_path, &mut boards).await?;

    // Sort by modification time (most recent first)
    boards.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(boards)
}

// Tauri commands
#[tauri::command]
pub async fn list_kanban_boards(workspace_path: String) -> Result<Vec<BoardInfo>, String> {
    let path = Path::new(&workspace_path);
    list_boards_in_workspace(path).await
}

#[tauri::command]
pub async fn create_kanban_board(
    workspace_path: String,
    name: String,
    columns: Vec<String>,
) -> Result<KanbanBoard, String> {
    let board = KanbanBoard::new(name.clone(), columns);
    let sanitized_name = name.replace(|c: char| !c.is_alphanumeric() && c != ' ', "");
    let file_name = format!("{}.kanban", sanitized_name);
    let file_path = Path::new(&workspace_path).join(file_name);

    save_board_to_file(&file_path, &board).await?;
    Ok(board)
}

#[tauri::command]
pub async fn open_kanban_board(file_path: String) -> Result<KanbanBoard, String> {
    let path = Path::new(&file_path);
    load_board_from_file(path).await
}

#[tauri::command]
pub async fn save_kanban_board(file_path: String, board: KanbanBoard) -> Result<(), String> {
    let path = Path::new(&file_path);
    save_board_to_file(path, &board).await
}

#[tauri::command]
pub async fn delete_kanban_board(file_path: String) -> Result<(), String> {
    tokio::fs::remove_file(&file_path)
        .await
        .map_err(|e| format!("Failed to delete board: {}", e))
}

#[tauri::command]
pub async fn rename_kanban_board(old_path: String, new_name: String) -> Result<String, String> {
    let old_path_buf = PathBuf::from(&old_path);
    let parent = old_path_buf.parent()
        .ok_or_else(|| String::from("Invalid file path"))?;

    let sanitized_name = new_name.replace(|c: char| !c.is_alphanumeric() && c != ' ', "");
    let new_file_name = format!("{}.kanban", sanitized_name);
    let new_path = parent.join(new_file_name);

    // Load board and update name
    let mut board = load_board_from_file(&old_path_buf).await?;
    board.name = new_name;
    board.metadata.modified = chrono::Utc::now().to_rfc3339();

    // Save to new path and delete old file
    save_board_to_file(&new_path, &board).await?;
    tokio::fs::remove_file(&old_path)
        .await
        .map_err(|e| format!("Failed to delete old board file: {}", e))?;

    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn add_card_to_board(
    board_path: String,
    column_id: String,
    title: String,
    description: Option<String>,
    tags: Vec<String>,
    priority: String,
) -> Result<KanbanCard, String> {
    let path = Path::new(&board_path);
    let mut board = load_board_from_file(path).await?;

    let mut card = KanbanCard::new(title);
    card.description = description;
    card.tags = tags;
    card.priority = priority;

    board.add_card(&column_id, card.clone())?;
    save_board_to_file(path, &board).await?;

    Ok(card)
}

#[tauri::command]
pub async fn move_card_between_columns(
    board_path: String,
    card_id: String,
    from_column: String,
    to_column: String,
) -> Result<(), String> {
    let path = Path::new(&board_path);
    let mut board = load_board_from_file(path).await?;

    board.move_card(&card_id, &from_column, &to_column)?;
    save_board_to_file(path, &board).await
}

#[tauri::command]
pub async fn update_card_in_board(
    board_path: String,
    card: KanbanCard,
) -> Result<KanbanCard, String> {
    let path = Path::new(&board_path);
    let mut board = load_board_from_file(path).await?;

    let card_id = card.id.clone();
    let updated_card = board.update_card(&card_id, card)?;
    save_board_to_file(path, &board).await?;

    Ok(updated_card)
}

#[tauri::command]
pub async fn delete_card_from_board(
    board_path: String,
    card_id: String,
) -> Result<(), String> {
    let path = Path::new(&board_path);
    let mut board = load_board_from_file(path).await?;

    board.delete_card(&card_id)?;
    save_board_to_file(path, &board).await
}

// Initialize workspace with default kanban board
pub async fn init_default_kanban_board(workspace_path: &Path) -> Result<(), String> {
    // Check if any .kanban files already exist
    let mut entries = tokio::fs::read_dir(workspace_path)
        .await
        .map_err(|e| format!("Failed to read workspace directory: {}", e))?;

    let mut has_kanban = false;
    while let Some(entry) = entries.next_entry().await.map_err(|e| format!("Failed to read directory entry: {}", e))? {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("kanban") {
            has_kanban = true;
            break;
        }
    }

    // Only create default board if none exists
    if !has_kanban {
        let board = KanbanBoard::new(
            String::from("Tasks"),
            vec![
                String::from("To Do"),
                String::from("In Progress"),
                String::from("Done"),
            ],
        );
        let file_path = workspace_path.join("Tasks.kanban");
        save_board_to_file(&file_path, &board).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn initialize_workspace_kanban(workspace_path: String) -> Result<(), String> {
    let path = Path::new(&workspace_path);
    init_default_kanban_board(path).await
}

// External dependencies are already in Cargo.toml
