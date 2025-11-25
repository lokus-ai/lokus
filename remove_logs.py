import os
import re

def remove_logs_from_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    ext = os.path.splitext(filepath)[1].lower()
    
    if ext in ['.js', '.jsx', '.ts', '.tsx']:
        new_content = remove_js_logs(content)
    elif ext == '.rs':
        new_content = remove_rust_logs(content)
    else:
        return

    if new_content != content:
        print(f"Removing logs from: {filepath}")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

def find_balanced_end(content, start_index):
    """
    Finds the index of the closing parenthesis matching the one at start_index.
    start_index should point to the opening '('.
    Returns the index of the character AFTER the closing ')'.
    """
    length = len(content)
    i = start_index + 1
    depth = 1
    
    state = 'CODE' # CODE, STRING_SINGLE, STRING_DOUBLE, STRING_BACKTICK, COMMENT_LINE, COMMENT_BLOCK
    
    while i < length and depth > 0:
        char = content[i]
        
        if state == 'CODE':
            if char == "'": state = 'STRING_SINGLE'
            elif char == '"': state = 'STRING_DOUBLE'
            elif char == '`': state = 'STRING_BACKTICK'
            elif char == '/' and i+1 < length:
                if content[i+1] == '/': state = 'COMMENT_LINE'; i+=1
                elif content[i+1] == '*': state = 'COMMENT_BLOCK'; i+=1
            elif char == '(': depth += 1
            elif char == ')': depth -= 1
            
        elif state == 'STRING_SINGLE':
            if char == '\\': i += 1 # Skip escaped char
            elif char == "'": state = 'CODE'
        elif state == 'STRING_DOUBLE':
            if char == '\\': i += 1 # Skip escaped char
            elif char == '"': state = 'CODE'
        elif state == 'STRING_BACKTICK':
            if char == '\\': i += 1 # Skip escaped char
            elif char == '`': state = 'CODE'
        elif state == 'COMMENT_LINE':
            if char == '\n': state = 'CODE'
        elif state == 'COMMENT_BLOCK':
            if char == '*' and i+1 < length and content[i+1] == '/':
                state = 'CODE'
                i += 1
        
        i += 1
        
    return i

def remove_js_logs(content):
    pattern = re.compile(r'console\s*\.\s*log\s*\(')
    
    output = []
    i = 0
    length = len(content)
    state = 'CODE'
    
    while i < length:
        char = content[i]
        
        match = None
        if state == 'CODE':
            match = pattern.match(content, i)
        
        if match:
            open_paren_idx = match.end() - 1
            end_idx = find_balanced_end(content, open_paren_idx)
            
            next_i = end_idx
            if next_i < length and content[next_i] == ';':
                next_i += 1
                
            line_start = content.rfind('\n', 0, i) + 1
            text_before = content[line_start:i]
            if text_before.strip() == '':
                line_end = content.find('\n', next_i)
                if line_end == -1: line_end = length
                text_after = content[next_i:line_end]
                
                if text_after.strip() == '':
                    if line_end < length:
                        next_i = line_end + 1
                    else:
                        next_i = length
                    ws_len = len(text_before)
                    if len(output) >= ws_len:
                        del output[-ws_len:]
            
            i = next_i
            continue

        if state == 'CODE':
            if char == "'": state = 'STRING_SINGLE'
            elif char == '"': state = 'STRING_DOUBLE'
            elif char == '`': state = 'STRING_BACKTICK'
            elif char == '/' and i+1 < length:
                if content[i+1] == '/': state = 'COMMENT_LINE'; output.append(char); i+=1; output.append(content[i]); i+=1; continue
                elif content[i+1] == '*': state = 'COMMENT_BLOCK'; output.append(char); i+=1; output.append(content[i]); i+=1; continue
        elif state == 'STRING_SINGLE':
            if char == '\\':
                output.append(char); i+=1; 
                if i < length: output.append(content[i])
                i+=1; continue
            elif char == "'": state = 'CODE'
        elif state == 'STRING_DOUBLE':
            if char == '\\':
                output.append(char); i+=1; 
                if i < length: output.append(content[i])
                i+=1; continue
            elif char == '"': state = 'CODE'
        elif state == 'STRING_BACKTICK':
            if char == '\\':
                output.append(char); i+=1; 
                if i < length: output.append(content[i])
                i+=1; continue
            elif char == '`': state = 'CODE'
        elif state == 'COMMENT_LINE':
            if char == '\n': state = 'CODE'
        elif state == 'COMMENT_BLOCK':
            if char == '*' and i+1 < length and content[i+1] == '/':
                state = 'CODE'
                output.append(char); i+=1; output.append(content[i]); i+=1; continue

        output.append(char)
        i += 1
        
    return "".join(output)

def remove_rust_logs(content):
    output = []
    i = 0
    length = len(content)
    state = 'CODE'
    
    while i < length:
        char = content[i]
        
        match_print = None
        match_dbg = None
        
        if state == 'CODE':
            if content[i:].startswith('println!') or content[i:].startswith('eprintln!'):
                match_print = re.match(r'(e?println!)\s*\(', content[i:])
            elif content[i:].startswith('dbg!'):
                match_dbg = re.match(r'dbg!\s*\(', content[i:])
        
        if match_print:
            open_paren_idx = i + match_print.end() - 1
            end_idx = find_balanced_end(content, open_paren_idx)
            
            next_i = end_idx
            if next_i < length and content[next_i] == ';':
                next_i += 1
            
            line_start = content.rfind('\n', 0, i) + 1
            text_before = content[line_start:i]
            if text_before.strip() == '':
                line_end = content.find('\n', next_i)
                if line_end == -1: line_end = length
                text_after = content[next_i:line_end]
                if text_after.strip() == '':
                    if line_end < length:
                        next_i = line_end + 1
                    else:
                        next_i = length
                    ws_len = len(text_before)
                    if len(output) >= ws_len:
                        del output[-ws_len:]
            
            i = next_i
            continue
            
        if match_dbg:
            open_paren_idx = i + match_dbg.end() - 1
            end_idx = find_balanced_end(content, open_paren_idx)
            inner = content[open_paren_idx+1 : end_idx-1]
            output.append(inner)
            i = end_idx
            continue

        if state == 'CODE':
            if char == '"': state = 'STRING_DOUBLE'
            elif char == '/' and i+1 < length:
                if content[i+1] == '/': state = 'COMMENT_LINE'; output.append(char); i+=1; output.append(content[i]); i+=1; continue
                elif content[i+1] == '*': state = 'COMMENT_BLOCK'; output.append(char); i+=1; output.append(content[i]); i+=1; continue
        elif state == 'STRING_DOUBLE':
            if char == '\\':
                output.append(char); i+=1; 
                if i < length: output.append(content[i])
                i+=1; continue
            elif char == '"': state = 'CODE'
        elif state == 'COMMENT_LINE':
            if char == '\n': state = 'CODE'
        elif state == 'COMMENT_BLOCK':
            if char == '*' and i+1 < length and content[i+1] == '/':
                state = 'CODE'
                output.append(char); i+=1; output.append(content[i]); i+=1; continue
                
        output.append(char)
        i += 1
        
    return "".join(output)

def main():
    root_dir = os.getcwd()
    print(f"Scanning {root_dir}...")
    
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if 'target' in dirs: dirs.remove('target')
        if '.git' in dirs: dirs.remove('.git')
            
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.rs')):
                filepath = os.path.join(root, file)
                try:
                    remove_logs_from_file(filepath)
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")

if __name__ == '__main__':
    main()
