#!/usr/bin/env python3
"""
File Synchronization Tool using Lokus MCP Server

This example demonstrates how to create a file synchronization tool that:
- Monitors a local directory for changes
- Syncs changes with Lokus workspace via MCP
- Handles conflict resolution
- Provides bidirectional sync capabilities
- Supports real-time updates via WebSocket subscriptions

Usage:
    python file-sync.py --local-dir ./my-notes --sync-dir /workspace/synced
"""

import asyncio
import json
import os
import sys
import time
import hashlib
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set
import logging

import websockets
import aiofiles
import watchdog.events
import watchdog.observers
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FileMetadata:
    """Metadata for tracking file synchronization"""
    
    def __init__(self, path: str, size: int, mtime: float, checksum: str):
        self.path = path
        self.size = size
        self.mtime = mtime
        self.checksum = checksum
        self.sync_state = 'unknown'  # unknown, synced, local_newer, remote_newer, conflict
        
    def to_dict(self):
        return {
            'path': self.path,
            'size': self.size,
            'mtime': self.mtime,
            'checksum': self.checksum,
            'sync_state': self.sync_state
        }
    
    @classmethod
    def from_dict(cls, data):
        metadata = cls(
            data['path'],
            data['size'], 
            data['mtime'],
            data['checksum']
        )
        metadata.sync_state = data.get('sync_state', 'unknown')
        return metadata


class MCPFileSyncClient:
    """MCP client for file synchronization"""
    
    def __init__(self, mcp_url: str, api_key: str):
        self.mcp_url = mcp_url
        self.api_key = api_key
        self.ws = None
        self.message_id = 1
        self.pending_requests = {}
        self.is_initialized = False
        self.subscriptions = set()
        
    async def connect(self):
        """Connect to MCP server"""
        try:
            self.ws = await websockets.connect(
                self.mcp_url,
                extra_headers={'Authorization': f'Bearer {self.api_key}'}
            )
            
            # Start message handler
            asyncio.create_task(self._handle_messages())
            
            # Initialize session
            await self.initialize()
            
            logger.info("Connected to Lokus MCP server")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MCP server: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from MCP server"""
        if self.ws:
            await self.ws.close()
            logger.info("Disconnected from MCP server")
    
    async def initialize(self):
        """Initialize MCP session"""
        response = await self.send_request('initialize', {
            'protocolVersion': '2024-11-05',
            'capabilities': {
                'resources': {'subscribe': True},
                'tools': {'listChanged': True}
            },
            'clientInfo': {
                'name': 'Lokus File Sync Tool',
                'version': '1.0.0',
                'description': 'Bidirectional file synchronization with Lokus workspace'
            }
        })
        
        self.is_initialized = True
        logger.info("MCP session initialized")
        return response
    
    async def send_request(self, method: str, params: dict = None):
        """Send JSON-RPC request"""
        if not self.ws:
            raise ConnectionError("Not connected to MCP server")
        
        message_id = self.message_id
        self.message_id += 1
        
        message = {
            'jsonrpc': '2.0',
            'id': message_id,
            'method': method,
            'params': params or {}
        }
        
        # Create future for response
        future = asyncio.Future()
        self.pending_requests[message_id] = future
        
        # Send message
        await self.ws.send(json.dumps(message))
        
        try:
            # Wait for response with timeout
            response = await asyncio.wait_for(future, timeout=30.0)
            return response
        except asyncio.TimeoutError:
            self.pending_requests.pop(message_id, None)
            raise TimeoutError(f"Request {method} timed out")
    
    async def _handle_messages(self):
        """Handle incoming WebSocket messages"""
        try:
            async for message in self.ws:
                data = json.loads(message)
                
                if 'id' in data:
                    # Response to request
                    message_id = data['id']
                    future = self.pending_requests.pop(message_id, None)
                    
                    if future:
                        if 'error' in data:
                            error = data['error']
                            future.set_exception(
                                Exception(f"MCP Error {error['code']}: {error['message']}")
                            )
                        else:
                            future.set_result(data.get('result', {}))
                
                elif 'method' in data:
                    # Notification
                    await self._handle_notification(data['method'], data.get('params', {}))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("MCP WebSocket connection closed")
        except Exception as e:
            logger.error(f"Error handling MCP messages: {e}")
    
    async def _handle_notification(self, method: str, params: dict):
        """Handle incoming notifications"""
        if method == 'notifications/resources/updated':
            logger.info(f"Resource updated: {params.get('uri')}")
            # Handle remote file updates
            
        elif method == 'notifications/resources/list_changed':
            logger.info("Resource list changed")
    
    async def list_files(self, path_prefix: str = "") -> List[dict]:
        """List files in remote workspace"""
        response = await self.send_request('resources/list', {
            'type': 'file'
        })
        
        files = []
        for resource in response.get('resources', []):
            if resource['type'] == 'file' and resource['uri'].startswith(f'file://{path_prefix}'):
                files.append({
                    'path': resource['uri'].replace('file://', ''),
                    'name': resource['name'],
                    'uri': resource['uri'],
                    'lastModified': resource['lastModified']
                })
        
        return files
    
    async def read_file(self, remote_path: str) -> str:
        """Read file content from remote workspace"""
        uri = f'file://{remote_path}'
        response = await self.send_request('resources/read', {'uri': uri})
        
        if response['contents']:
            return response['contents'][0]['text']
        
        raise FileNotFoundError(f"Remote file not found: {remote_path}")
    
    async def write_file(self, remote_path: str, content: str) -> bool:
        """Write file to remote workspace"""
        response = await self.send_request('tools/call', {
            'name': 'create_file',
            'arguments': {
                'path': remote_path,
                'content': content,
                'overwrite': True
            }
        })
        
        return not response.get('isError', False)
    
    async def delete_file(self, remote_path: str) -> bool:
        """Delete file from remote workspace"""
        response = await self.send_request('tools/call', {
            'name': 'delete_file',
            'arguments': {'path': remote_path}
        })
        
        return not response.get('isError', False)
    
    async def subscribe_to_changes(self, remote_path: str):
        """Subscribe to changes in remote path"""
        uri = f'file://{remote_path}'
        
        if uri not in self.subscriptions:
            await self.send_request('resources/subscribe', {'uri': uri})
            self.subscriptions.add(uri)
            logger.info(f"Subscribed to changes in {remote_path}")


class LocalFileWatcher(FileSystemEventHandler):
    """Watch local filesystem for changes"""
    
    def __init__(self, sync_manager):
        self.sync_manager = sync_manager
        
    def on_modified(self, event):
        if not event.is_directory:
            asyncio.create_task(
                self.sync_manager.handle_local_change(event.src_path, 'modified')
            )
    
    def on_created(self, event):
        if not event.is_directory:
            asyncio.create_task(
                self.sync_manager.handle_local_change(event.src_path, 'created')
            )
    
    def on_deleted(self, event):
        if not event.is_directory:
            asyncio.create_task(
                self.sync_manager.handle_local_change(event.src_path, 'deleted')
            )


class FileSyncManager:
    """Main file synchronization manager"""
    
    def __init__(self, local_dir: str, remote_dir: str, mcp_client: MCPFileSyncClient):
        self.local_dir = Path(local_dir).resolve()
        self.remote_dir = remote_dir
        self.mcp_client = mcp_client
        
        # Metadata tracking
        self.metadata_file = self.local_dir / '.lokus-sync-metadata.json'
        self.file_metadata: Dict[str, FileMetadata] = {}
        
        # File watcher
        self.observer = Observer()
        self.event_handler = LocalFileWatcher(self)
        
        # Sync settings
        self.sync_interval = 30  # seconds
        self.conflict_resolution = 'ask'  # ask, local_wins, remote_wins, keep_both
        
        # State tracking
        self.is_syncing = False
        self.pending_changes = set()
        
        # Statistics
        self.stats = {
            'files_synced': 0,
            'conflicts_resolved': 0,
            'errors': 0,
            'last_sync': None
        }
    
    async def initialize(self):
        """Initialize sync manager"""
        # Create local directory if it doesn't exist
        self.local_dir.mkdir(parents=True, exist_ok=True)
        
        # Load existing metadata
        await self.load_metadata()
        
        # Start file watcher
        self.observer.schedule(
            self.event_handler,
            str(self.local_dir),
            recursive=True
        )
        self.observer.start()
        
        logger.info(f"File sync manager initialized")
        logger.info(f"Local directory: {self.local_dir}")
        logger.info(f"Remote directory: {self.remote_dir}")
    
    async def load_metadata(self):
        """Load sync metadata from disk"""
        try:
            if self.metadata_file.exists():
                async with aiofiles.open(self.metadata_file, 'r') as f:
                    data = json.loads(await f.read())
                    
                self.file_metadata = {
                    path: FileMetadata.from_dict(meta)
                    for path, meta in data.get('files', {}).items()
                }
                
                self.stats.update(data.get('stats', {}))
                logger.info(f"Loaded metadata for {len(self.file_metadata)} files")
                
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            self.file_metadata = {}
    
    async def save_metadata(self):
        """Save sync metadata to disk"""
        try:
            data = {
                'files': {
                    path: meta.to_dict()
                    for path, meta in self.file_metadata.items()
                },
                'stats': self.stats,
                'last_updated': datetime.now().isoformat()
            }
            
            async with aiofiles.open(self.metadata_file, 'w') as f:
                await f.write(json.dumps(data, indent=2))
                
        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")
    
    def calculate_file_checksum(self, file_path: Path) -> str:
        """Calculate MD5 checksum of file"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    async def get_local_files(self) -> Dict[str, FileMetadata]:
        """Scan local directory and get file metadata"""
        local_files = {}
        
        for file_path in self.local_dir.rglob('*'):
            if file_path.is_file() and not file_path.name.startswith('.'):
                try:
                    relative_path = file_path.relative_to(self.local_dir)
                    stat = file_path.stat()
                    checksum = self.calculate_file_checksum(file_path)
                    
                    local_files[str(relative_path)] = FileMetadata(
                        str(relative_path),
                        stat.st_size,
                        stat.st_mtime,
                        checksum
                    )
                    
                except Exception as e:
                    logger.error(f"Error processing local file {file_path}: {e}")
        
        return local_files
    
    async def get_remote_files(self) -> Dict[str, FileMetadata]:
        """Get remote file metadata from MCP server"""
        remote_files = {}
        
        try:
            files = await self.mcp_client.list_files(self.remote_dir)
            
            for file_info in files:
                # Extract relative path
                remote_path = file_info['path']
                if remote_path.startswith(self.remote_dir):
                    relative_path = remote_path[len(self.remote_dir):].lstrip('/')
                    
                    # For simplicity, we'll use file size and modification time
                    # In a real implementation, you'd want to get checksum from server
                    mtime = datetime.fromisoformat(
                        file_info['lastModified'].replace('Z', '+00:00')
                    ).timestamp()
                    
                    remote_files[relative_path] = FileMetadata(
                        relative_path,
                        0,  # Size not available from MCP
                        mtime,
                        ''  # Checksum not available
                    )
                    
        except Exception as e:
            logger.error(f"Error getting remote files: {e}")
        
        return remote_files
    
    async def sync_files(self):
        """Perform full file synchronization"""
        if self.is_syncing:
            logger.info("Sync already in progress, skipping")
            return
        
        self.is_syncing = True
        logger.info("Starting file synchronization...")
        
        try:
            # Get current state
            local_files = await self.get_local_files()
            remote_files = await self.get_remote_files()
            
            # Determine sync actions
            actions = await self.plan_sync_actions(local_files, remote_files)
            
            # Execute sync actions
            await self.execute_sync_actions(actions)
            
            # Update metadata
            self.file_metadata.update(local_files)
            await self.save_metadata()
            
            # Update statistics
            self.stats['last_sync'] = datetime.now().isoformat()
            
            logger.info(f"Sync completed. Processed {len(actions)} actions.")
            
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            self.stats['errors'] += 1
            
        finally:
            self.is_syncing = False
    
    async def plan_sync_actions(self, local_files: Dict[str, FileMetadata], 
                               remote_files: Dict[str, FileMetadata]) -> List[dict]:
        """Plan synchronization actions based on file states"""
        actions = []
        
        all_files = set(local_files.keys()) | set(remote_files.keys())
        
        for relative_path in all_files:
            local_meta = local_files.get(relative_path)
            remote_meta = remote_files.get(relative_path)
            stored_meta = self.file_metadata.get(relative_path)
            
            action = await self.determine_sync_action(
                relative_path, local_meta, remote_meta, stored_meta
            )
            
            if action:
                actions.append(action)
        
        return actions
    
    async def determine_sync_action(self, relative_path: str,
                                  local_meta: Optional[FileMetadata],
                                  remote_meta: Optional[FileMetadata], 
                                  stored_meta: Optional[FileMetadata]) -> Optional[dict]:
        """Determine what sync action to take for a file"""
        
        # File exists only locally
        if local_meta and not remote_meta:
            if not stored_meta:
                # New local file - upload
                return {
                    'action': 'upload',
                    'path': relative_path,
                    'reason': 'new_local_file'
                }
            else:
                # File was deleted remotely
                return await self.handle_delete_conflict(relative_path, 'remote_deleted')
        
        # File exists only remotely  
        if remote_meta and not local_meta:
            if not stored_meta:
                # New remote file - download
                return {
                    'action': 'download',
                    'path': relative_path,
                    'reason': 'new_remote_file'
                }
            else:
                # File was deleted locally
                return await self.handle_delete_conflict(relative_path, 'local_deleted')
        
        # File exists in both places
        if local_meta and remote_meta:
            if not stored_meta:
                # File exists in both but no sync history - potential conflict
                return await self.handle_content_conflict(relative_path, local_meta, remote_meta)
            
            # Compare with stored metadata to determine changes
            local_changed = (local_meta.mtime != stored_meta.mtime or 
                           local_meta.checksum != stored_meta.checksum)
            remote_changed = remote_meta.mtime != stored_meta.mtime
            
            if local_changed and not remote_changed:
                # Only local changed - upload
                return {
                    'action': 'upload',
                    'path': relative_path,
                    'reason': 'local_modified'
                }
            elif remote_changed and not local_changed:
                # Only remote changed - download
                return {
                    'action': 'download', 
                    'path': relative_path,
                    'reason': 'remote_modified'
                }
            elif local_changed and remote_changed:
                # Both changed - conflict
                return await self.handle_content_conflict(relative_path, local_meta, remote_meta)
        
        # File deleted from both or no changes
        return None
    
    async def handle_delete_conflict(self, relative_path: str, conflict_type: str) -> dict:
        """Handle deletion conflicts"""
        if self.conflict_resolution == 'ask':
            # In a real implementation, you'd prompt the user
            logger.warning(f"Delete conflict for {relative_path}: {conflict_type}")
            return {'action': 'skip', 'path': relative_path, 'reason': 'delete_conflict'}
        
        # Auto-resolve based on settings
        if conflict_type == 'remote_deleted':
            return {'action': 'delete_local', 'path': relative_path, 'reason': 'sync_deletion'}
        else:
            return {'action': 'delete_remote', 'path': relative_path, 'reason': 'sync_deletion'}
    
    async def handle_content_conflict(self, relative_path: str,
                                    local_meta: FileMetadata,
                                    remote_meta: FileMetadata) -> dict:
        """Handle content conflicts"""
        logger.warning(f"Content conflict detected for {relative_path}")
        
        if self.conflict_resolution == 'local_wins':
            return {'action': 'upload', 'path': relative_path, 'reason': 'conflict_local_wins'}
        elif self.conflict_resolution == 'remote_wins':
            return {'action': 'download', 'path': relative_path, 'reason': 'conflict_remote_wins'}
        elif self.conflict_resolution == 'keep_both':
            return {'action': 'keep_both', 'path': relative_path, 'reason': 'conflict_keep_both'}
        else:
            # Ask user - in real implementation would prompt
            return {'action': 'skip', 'path': relative_path, 'reason': 'conflict_requires_resolution'}
    
    async def execute_sync_actions(self, actions: List[dict]):
        """Execute planned sync actions"""
        for action in actions:
            try:
                await self.execute_single_action(action)
                self.stats['files_synced'] += 1
                
            except Exception as e:
                logger.error(f"Failed to execute action {action}: {e}")
                self.stats['errors'] += 1
    
    async def execute_single_action(self, action: dict):
        """Execute a single sync action"""
        path = action['path']
        action_type = action['action']
        
        logger.info(f"Executing {action_type} for {path} ({action['reason']})")
        
        if action_type == 'upload':
            await self.upload_file(path)
        elif action_type == 'download':
            await self.download_file(path)
        elif action_type == 'delete_local':
            await self.delete_local_file(path)
        elif action_type == 'delete_remote':
            await self.delete_remote_file(path)
        elif action_type == 'keep_both':
            await self.create_conflict_copy(path)
        elif action_type == 'skip':
            logger.info(f"Skipping {path}")
    
    async def upload_file(self, relative_path: str):
        """Upload local file to remote"""
        local_path = self.local_dir / relative_path
        remote_path = f"{self.remote_dir}/{relative_path}"
        
        async with aiofiles.open(local_path, 'r', encoding='utf-8') as f:
            content = await f.read()
        
        success = await self.mcp_client.write_file(remote_path, content)
        if success:
            logger.info(f"Uploaded {relative_path}")
        else:
            raise Exception(f"Failed to upload {relative_path}")
    
    async def download_file(self, relative_path: str):
        """Download remote file to local"""
        local_path = self.local_dir / relative_path
        remote_path = f"{self.remote_dir}/{relative_path}"
        
        # Create parent directories
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        content = await self.mcp_client.read_file(remote_path)
        
        async with aiofiles.open(local_path, 'w', encoding='utf-8') as f:
            await f.write(content)
        
        logger.info(f"Downloaded {relative_path}")
    
    async def delete_local_file(self, relative_path: str):
        """Delete local file"""
        local_path = self.local_dir / relative_path
        if local_path.exists():
            local_path.unlink()
            logger.info(f"Deleted local file {relative_path}")
    
    async def delete_remote_file(self, relative_path: str):
        """Delete remote file"""
        remote_path = f"{self.remote_dir}/{relative_path}"
        success = await self.mcp_client.delete_file(remote_path)
        if success:
            logger.info(f"Deleted remote file {relative_path}")
        else:
            raise Exception(f"Failed to delete remote file {relative_path}")
    
    async def create_conflict_copy(self, relative_path: str):
        """Create conflict copy when keeping both versions"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create local conflict copy
        local_path = self.local_dir / relative_path
        conflict_path = local_path.with_suffix(f'.conflict_local_{timestamp}{local_path.suffix}')
        
        if local_path.exists():
            async with aiofiles.open(local_path, 'r') as src, \
                      aiofiles.open(conflict_path, 'w') as dst:
                await dst.write(await src.read())
        
        # Download remote version as original
        await self.download_file(relative_path)
        
        logger.info(f"Created conflict copy for {relative_path}")
    
    async def handle_local_change(self, file_path: str, change_type: str):
        """Handle local file system changes"""
        try:
            relative_path = Path(file_path).relative_to(self.local_dir)
            
            # Ignore metadata file and hidden files
            if relative_path.name.startswith('.'):
                return
            
            logger.info(f"Local change detected: {change_type} {relative_path}")
            
            # Add to pending changes
            self.pending_changes.add(str(relative_path))
            
            # Trigger incremental sync after short delay
            await asyncio.sleep(2)  # Debounce rapid changes
            
            if str(relative_path) in self.pending_changes:
                await self.sync_single_file(str(relative_path))
                self.pending_changes.discard(str(relative_path))
                
        except Exception as e:
            logger.error(f"Error handling local change {file_path}: {e}")
    
    async def sync_single_file(self, relative_path: str):
        """Sync a single file immediately"""
        try:
            local_path = self.local_dir / relative_path
            
            if local_path.exists():
                # File created or modified
                await self.upload_file(relative_path)
            else:
                # File deleted
                remote_path = f"{self.remote_dir}/{relative_path}"
                await self.mcp_client.delete_file(remote_path)
            
            logger.info(f"Synced single file: {relative_path}")
            
        except Exception as e:
            logger.error(f"Error syncing single file {relative_path}: {e}")
    
    async def start_periodic_sync(self):
        """Start periodic synchronization"""
        logger.info(f"Starting periodic sync every {self.sync_interval} seconds")
        
        while True:
            try:
                await asyncio.sleep(self.sync_interval)
                await self.sync_files()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic sync: {e}")
    
    async def print_status(self):
        """Print current sync status"""
        print(f"""
📁 **Lokus File Sync Status**

**Configuration:**
• Local Directory: {self.local_dir}
• Remote Directory: {self.remote_dir}
• Sync Interval: {self.sync_interval}s
• Conflict Resolution: {self.conflict_resolution}

**Statistics:**
• Files Synced: {self.stats['files_synced']}
• Conflicts Resolved: {self.stats['conflicts_resolved']}
• Errors: {self.stats['errors']}
• Last Sync: {self.stats.get('last_sync', 'Never')}

**Current State:**
• Tracked Files: {len(self.file_metadata)}
• Pending Changes: {len(self.pending_changes)}
• Sync In Progress: {self.is_syncing}
""")
    
    def stop(self):
        """Stop file sync manager"""
        self.observer.stop()
        self.observer.join()
        logger.info("File sync manager stopped")


async def main():
    """Main application entry point"""
    parser = argparse.ArgumentParser(description='Lokus File Synchronization Tool')
    parser.add_argument('--local-dir', required=True, help='Local directory to sync')
    parser.add_argument('--remote-dir', default='/workspace/synced', help='Remote directory path')
    parser.add_argument('--mcp-url', default='ws://localhost:3001/mcp', help='MCP server URL')
    parser.add_argument('--api-key', help='API key for authentication')
    parser.add_argument('--sync-interval', type=int, default=30, help='Sync interval in seconds')
    parser.add_argument('--conflict-resolution', choices=['ask', 'local_wins', 'remote_wins', 'keep_both'], 
                       default='ask', help='Conflict resolution strategy')
    parser.add_argument('--one-shot', action='store_true', help='Run sync once and exit')
    parser.add_argument('--status', action='store_true', help='Show status and exit')
    
    args = parser.parse_args()
    
    # Get API key from environment if not provided
    api_key = args.api_key or os.getenv('LOKUS_API_KEY')
    if not api_key:
        logger.error("API key required. Use --api-key or set LOKUS_API_KEY environment variable")
        sys.exit(1)
    
    # Create MCP client
    mcp_client = MCPFileSyncClient(args.mcp_url, api_key)
    
    # Connect to server
    if not await mcp_client.connect():
        sys.exit(1)
    
    try:
        # Create sync manager
        sync_manager = FileSyncManager(args.local_dir, args.remote_dir, mcp_client)
        sync_manager.sync_interval = args.sync_interval
        sync_manager.conflict_resolution = args.conflict_resolution
        
        # Initialize
        await sync_manager.initialize()
        
        if args.status:
            # Show status and exit
            await sync_manager.print_status()
            return
        
        if args.one_shot:
            # Run sync once and exit
            logger.info("Running one-shot synchronization...")
            await sync_manager.sync_files()
            await sync_manager.print_status()
        else:
            # Start continuous sync
            logger.info("Starting continuous file synchronization...")
            logger.info("Press Ctrl+C to stop")
            
            # Start periodic sync
            sync_task = asyncio.create_task(sync_manager.start_periodic_sync())
            
            try:
                await sync_task
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
                sync_task.cancel()
                
                try:
                    await sync_task
                except asyncio.CancelledError:
                    pass
        
        # Clean up
        sync_manager.stop()
        
    finally:
        await mcp_client.disconnect()


if __name__ == '__main__':
    asyncio.run(main())