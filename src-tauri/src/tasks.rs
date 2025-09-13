use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use tauri_plugin_store::{StoreBuilder, JsonValue};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Todo,
    #[serde(rename = "in-progress")]
    InProgress,
    Urgent,
    #[serde(rename = "needs-info")]
    NeedsInfo,
    Completed,
    Cancelled,
    Delegated,
}

impl Default for TaskStatus {
    fn default() -> Self {
        TaskStatus::Todo
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: i32,
    pub created_at: i64,
    pub updated_at: i64,
    pub note_path: Option<String>,
    pub note_position: Option<i32>,
    pub tags: Vec<String>,
}

impl Task {
    pub fn new(title: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            description: None,
            status: TaskStatus::default(),
            priority: 0,
            created_at: now,
            updated_at: now,
            note_path: None,
            note_position: None,
            tags: Vec::new(),
        }
    }

    pub fn update_status(&mut self, status: TaskStatus) {
        self.status = status;
        self.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskStore {
    pub tasks: HashMap<String, Task>,
}

impl Default for TaskStore {
    fn default() -> Self {
        Self {
            tasks: HashMap::new(),
        }
    }
}

impl TaskStore {
    pub fn add_task(&mut self, task: Task) {
        self.tasks.insert(task.id.clone(), task);
    }

    pub fn update_task(&mut self, task_id: &str, task: Task) -> Result<(), String> {
        if self.tasks.contains_key(task_id) {
            self.tasks.insert(task_id.to_string(), task);
            Ok(())
        } else {
            Err(format!("Task with id {} not found", task_id))
        }
    }

    pub fn delete_task(&mut self, task_id: &str) -> Result<(), String> {
        if self.tasks.remove(task_id).is_some() {
            Ok(())
        } else {
            Err(format!("Task with id {} not found", task_id))
        }
    }

    pub fn get_task(&self, task_id: &str) -> Option<&Task> {
        self.tasks.get(task_id)
    }

    pub fn get_all_tasks(&self) -> Vec<&Task> {
        self.tasks.values().collect()
    }

    pub fn get_tasks_by_status(&self, status: &TaskStatus) -> Vec<&Task> {
        self.tasks
            .values()
            .filter(|task| &task.status == status)
            .collect()
    }

    pub fn get_tasks_by_note(&self, note_path: &str) -> Vec<&Task> {
        self.tasks
            .values()
            .filter(|task| {
                task.note_path
                    .as_ref()
                    .map_or(false, |path| path == note_path)
            })
            .collect()
    }
}

fn get_task_store(app: &AppHandle) -> Result<TaskStore, String> {
    let store = StoreBuilder::new(app, PathBuf::from(".tasks.dat"))
        .build()
        .map_err(|e| format!("Failed to build task store: {}", e))?;
    
    let _ = store.reload();
    
    match store.get("tasks") {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to deserialize tasks: {}", e)),
        None => Ok(TaskStore::default()),
    }
}

fn save_task_store(app: &AppHandle, task_store: &TaskStore) -> Result<(), String> {
    let store = StoreBuilder::new(app, PathBuf::from(".tasks.dat"))
        .build()
        .map_err(|e| format!("Failed to build task store: {}", e))?;
    
    let _ = store.reload();
    
    let serialized = serde_json::to_value(task_store)
        .map_err(|e| format!("Failed to serialize tasks: {}", e))?;
    
    store.set("tasks".to_string(), serialized);
    
    store
        .save()
        .map_err(|e| format!("Failed to save task store: {}", e))?;
    
    Ok(())
}

// Tauri commands
#[tauri::command]
pub async fn create_task(app: AppHandle, title: String, description: Option<String>, note_path: Option<String>, note_position: Option<i32>) -> Result<Task, String> {
    let mut task = Task::new(title);
    task.description = description;
    task.note_path = note_path;
    task.note_position = note_position;
    
    let mut task_store = get_task_store(&app)?;
    task_store.add_task(task.clone());
    save_task_store(&app, &task_store)?;
    
    Ok(task)
}

#[tauri::command]
pub async fn get_all_tasks(app: AppHandle) -> Result<Vec<Task>, String> {
    let task_store = get_task_store(&app)?;
    Ok(task_store.get_all_tasks().into_iter().cloned().collect())
}

#[tauri::command]
pub async fn get_task(app: AppHandle, task_id: String) -> Result<Option<Task>, String> {
    let task_store = get_task_store(&app)?;
    Ok(task_store.get_task(&task_id).cloned())
}

#[tauri::command]
pub async fn update_task(app: AppHandle, task_id: String, title: Option<String>, description: Option<String>, status: Option<TaskStatus>, priority: Option<i32>) -> Result<Task, String> {
    let mut task_store = get_task_store(&app)?;
    
    let mut task = task_store
        .get_task(&task_id)
        .ok_or_else(|| format!("Task with id {} not found", task_id))?
        .clone();
    
    if let Some(new_title) = title {
        task.title = new_title;
    }
    if let Some(new_description) = description {
        task.description = Some(new_description);
    }
    if let Some(new_status) = status {
        task.update_status(new_status);
    }
    if let Some(new_priority) = priority {
        task.priority = new_priority;
        task.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
    }
    
    task_store.update_task(&task_id, task.clone())?;
    save_task_store(&app, &task_store)?;
    
    Ok(task)
}

#[tauri::command]
pub async fn delete_task(app: AppHandle, task_id: String) -> Result<(), String> {
    let mut task_store = get_task_store(&app)?;
    task_store.delete_task(&task_id)?;
    save_task_store(&app, &task_store)?;
    Ok(())
}

#[tauri::command]
pub async fn get_tasks_by_status(app: AppHandle, status: TaskStatus) -> Result<Vec<Task>, String> {
    let task_store = get_task_store(&app)?;
    Ok(task_store
        .get_tasks_by_status(&status)
        .into_iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn get_tasks_by_note(app: AppHandle, note_path: String) -> Result<Vec<Task>, String> {
    let task_store = get_task_store(&app)?;
    Ok(task_store
        .get_tasks_by_note(&note_path)
        .into_iter()
        .cloned()
        .collect())
}

#[tauri::command]
pub async fn bulk_update_task_status(app: AppHandle, task_ids: Vec<String>, status: TaskStatus) -> Result<Vec<Task>, String> {
    let mut task_store = get_task_store(&app)?;
    let mut updated_tasks = Vec::new();
    
    for task_id in task_ids {
        if let Some(mut task) = task_store.get_task(&task_id).cloned() {
            task.update_status(status.clone());
            task_store.update_task(&task_id, task.clone())?;
            updated_tasks.push(task);
        }
    }
    
    save_task_store(&app, &task_store)?;
    Ok(updated_tasks)
}

#[tauri::command]
pub async fn extract_tasks_from_content(content: String, note_path: String) -> Result<Vec<Task>, String> {
    let mut tasks = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    
    for (line_num, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        
        // Match checkboxes: - [ ] Task or - [x] Task
        if let Some(captures) = regex::Regex::new(r"^-\s*\[[ x]\]\s*(.+)")
            .unwrap()
            .captures(trimmed)
        {
            if let Some(title_match) = captures.get(1) {
                let title = title_match.as_str().trim().to_string();
                if !title.is_empty() {
                    let mut task = Task::new(title);
                    task.note_path = Some(note_path.clone());
                    task.note_position = Some(line_num as i32);
                    
                    // Set status based on checkbox state
                    if trimmed.contains("[x]") || trimmed.contains("[X]") {
                        task.status = TaskStatus::Completed;
                    }
                    
                    tasks.push(task);
                }
            }
        }
        
        // Match headings with task keywords: ## TODO: Fix bug, ### URGENT: Review code
        else if let Some(captures) = regex::Regex::new(r"^#+\s*(TODO|FIXME|URGENT|BUG)[:]\s*(.+)")
            .unwrap()
            .captures(trimmed)
        {
            if let Some(keyword_match) = captures.get(1) {
                if let Some(title_match) = captures.get(2) {
                    let keyword = keyword_match.as_str();
                    let title = title_match.as_str().trim().to_string();
                    if !title.is_empty() {
                        let mut task = Task::new(title);
                        task.note_path = Some(note_path.clone());
                        task.note_position = Some(line_num as i32);
                        
                        // Set status based on keyword
                        task.status = match keyword {
                            "URGENT" => TaskStatus::Urgent,
                            "TODO" | "FIXME" | "BUG" => TaskStatus::Todo,
                            _ => TaskStatus::Todo,
                        };
                        
                        tasks.push(task);
                    }
                }
            }
        }
        
        // Match natural language patterns: "need to", "must do", "should complete"
        else if let Some(captures) = regex::Regex::new(r"(?i)(need to|must do|should complete|have to|got to)\s+(.{3,})")
            .unwrap()
            .captures(trimmed)
        {
            if let Some(task_match) = captures.get(2) {
                let title = task_match.as_str().trim().to_string();
                if !title.is_empty() && title.len() <= 200 { // Reasonable length limit
                    let mut task = Task::new(title);
                    task.note_path = Some(note_path.clone());
                    task.note_position = Some(line_num as i32);
                    tasks.push(task);
                }
            }
        }
    }
    
    Ok(tasks)
}

// Module for UUID generation (simplified implementation)
mod uuid {
    use std::fmt;
    
    pub struct Uuid([u8; 16]);
    
    impl Uuid {
        pub fn new_v4() -> Self {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            use std::time::SystemTime;
            
            let mut hasher = DefaultHasher::new();
            SystemTime::now().hash(&mut hasher);
            std::thread::current().id().hash(&mut hasher);
            
            let hash = hasher.finish();
            let mut bytes = [0u8; 16];
            bytes[0..8].copy_from_slice(&hash.to_be_bytes());
            bytes[8..16].copy_from_slice(&hash.to_le_bytes());
            
            // Set version (4) and variant bits
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            
            Uuid(bytes)
        }
        
        pub fn to_string(&self) -> String {
            format!("{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                self.0[0], self.0[1], self.0[2], self.0[3],
                self.0[4], self.0[5],
                self.0[6], self.0[7],
                self.0[8], self.0[9],
                self.0[10], self.0[11], self.0[12], self.0[13], self.0[14], self.0[15]
            )
        }
    }
    
    impl fmt::Display for Uuid {
        fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
            write!(f, "{}", self.to_string())
        }
    }
}

// Simple regex implementation for task extraction
mod regex {
    pub struct Regex {
        pattern: String,
    }
    
    pub struct Captures {
        matches: Vec<Option<String>>,
    }
    
    impl Captures {
        pub fn get(&self, index: usize) -> Option<Match> {
            self.matches.get(index).and_then(|m| m.as_ref()).map(|s| Match { text: s.clone() })
        }
    }
    
    pub struct Match {
        text: String,
    }
    
    impl Match {
        pub fn as_str(&self) -> &str {
            &self.text
        }
    }
    
    impl Regex {
        pub fn new(pattern: &str) -> Result<Self, String> {
            Ok(Regex {
                pattern: pattern.to_string(),
            })
        }
        
        pub fn captures(&self, text: &str) -> Option<Captures> {
            // Simplified regex implementation for specific patterns
            match self.pattern.as_str() {
                r"^-\s*\[[ x]\]\s*(.+)" => {
                    if let Some(start) = text.find("- [") {
                        if let Some(end) = text[start..].find(']') {
                            let task_start = start + end + 1;
                            let task_text = text[task_start..].trim().to_string();
                            if !task_text.is_empty() {
                                return Some(Captures {
                                    matches: vec![Some(text.to_string()), Some(task_text)],
                                });
                            }
                        }
                    }
                    None
                }
                r"^#+\s*(TODO|FIXME|URGENT|BUG)[:]\s*(.+)" => {
                    let keywords = ["TODO:", "FIXME:", "URGENT:", "BUG:"];
                    for keyword in &keywords {
                        if let Some(pos) = text.find(keyword) {
                            let after_keyword = &text[pos + keyword.len()..];
                            let task_text = after_keyword.trim().to_string();
                            if !task_text.is_empty() {
                                let keyword_only = keyword.trim_end_matches(':').to_string();
                                return Some(Captures {
                                    matches: vec![Some(text.to_string()), Some(keyword_only), Some(task_text)],
                                });
                            }
                        }
                    }
                    None
                }
                r"(?i)(need to|must do|should complete|have to|got to)\s+(.{3,})" => {
                    let patterns = ["need to", "must do", "should complete", "have to", "got to"];
                    let lower_text = text.to_lowercase();
                    for pattern in &patterns {
                        if let Some(pos) = lower_text.find(pattern) {
                            let after_pattern = &text[pos + pattern.len()..];
                            let task_text = after_pattern.trim().to_string();
                            if task_text.len() >= 3 {
                                return Some(Captures {
                                    matches: vec![Some(text.to_string()), Some(pattern.to_string()), Some(task_text)],
                                });
                            }
                        }
                    }
                    None
                }
                _ => None,
            }
        }
    }
    
    pub fn unwrap(result: Result<Regex, String>) -> Regex {
        result.unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_creation() {
        let task = Task::new("Test task".to_string());
        assert_eq!(task.title, "Test task");
        assert_eq!(task.status, TaskStatus::Todo);
        assert!(task.id.len() > 0);
    }

    #[test]
    fn test_task_status_update() {
        let mut task = Task::new("Test task".to_string());
        let original_updated_at = task.updated_at;
        
        // Sleep to ensure timestamp changes
        std::thread::sleep(std::time::Duration::from_millis(1));
        task.update_status(TaskStatus::Completed);
        
        assert_eq!(task.status, TaskStatus::Completed);
        assert!(task.updated_at > original_updated_at);
    }

    #[test]
    fn test_task_store_operations() {
        let mut store = TaskStore::default();
        let task = Task::new("Test task".to_string());
        let task_id = task.id.clone();
        
        // Add task
        store.add_task(task);
        assert!(store.get_task(&task_id).is_some());
        
        // Update task
        let mut updated_task = store.get_task(&task_id).unwrap().clone();
        updated_task.title = "Updated task".to_string();
        store.update_task(&task_id, updated_task).unwrap();
        assert_eq!(store.get_task(&task_id).unwrap().title, "Updated task");
        
        // Delete task
        store.delete_task(&task_id).unwrap();
        assert!(store.get_task(&task_id).is_none());
    }

    #[tokio::test]
    async fn test_task_extraction() {
        let content = r#"
# My Notes

- [ ] Complete the project
- [x] Review code
- [ ] Write documentation

## TODO: Fix the bug

### URGENT: Deploy to production

I need to call the client about the meeting.
We must do the testing before release.
        "#;

        let tasks = extract_tasks_from_content(content.to_string(), "test.md".to_string()).await.unwrap();
        
        // Should find multiple tasks from different patterns
        assert!(tasks.len() >= 5);
        
        // Check specific patterns
        let todo_tasks: Vec<_> = tasks.iter().filter(|t| t.title.contains("Complete the project")).collect();
        assert_eq!(todo_tasks.len(), 1);
        
        let completed_tasks: Vec<_> = tasks.iter().filter(|t| t.status == TaskStatus::Completed).collect();
        assert_eq!(completed_tasks.len(), 1);
        
        let urgent_tasks: Vec<_> = tasks.iter().filter(|t| t.status == TaskStatus::Urgent).collect();
        assert_eq!(urgent_tasks.len(), 1);
    }
}