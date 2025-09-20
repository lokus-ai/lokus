#!/usr/bin/env python3
"""
Lokus MCP Python Client Example

This example demonstrates how to connect to a Lokus MCP server using Python.
It includes resource discovery, tool execution, and real-time subscriptions.

Requirements:
    pip install websockets aiohttp asyncio

Usage:
    python python-client.py

Environment Variables:
    LOKUS_API_KEY: Your Lokus API key
    LOKUS_MCP_URL: MCP server URL (default: ws://localhost:3001/mcp)
"""

import asyncio
import json
import logging
import os
import sys
from typing import Dict, List, Optional, Any, Callable
import websockets
import aiohttp
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class LokusMCPClient:
    """Lokus MCP Client for Python"""
    
    def __init__(self, 
                 websocket_url: str = "ws://localhost:3001/mcp",
                 http_url: str = "http://localhost:3001/api/mcp",
                 api_key: Optional[str] = None):
        """
        Initialize the MCP client
        
        Args:
            websocket_url: WebSocket URL for real-time communication
            http_url: HTTP URL for REST API calls
            api_key: API key for authentication
        """
        self.websocket_url = websocket_url
        self.http_url = http_url
        self.api_key = api_key or os.getenv('LOKUS_API_KEY')
        
        self.ws = None
        self.message_id = 1
        self.pending_requests: Dict[int, asyncio.Future] = {}
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.is_initialized = False
        self.server_info = None
        self.server_capabilities = None
        
    async def connect(self) -> bool:
        """Connect to the MCP server via WebSocket"""
        try:
            headers = {}
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'
            
            self.ws = await websockets.connect(
                self.websocket_url,
                extra_headers=headers,
                ping_interval=30
            )
            
            logger.info(f"Connected to Lokus MCP server at {self.websocket_url}")
            
            # Start message handler
            asyncio.create_task(self._handle_messages())
            
            # Initialize the session
            await self.initialize()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MCP server: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the MCP server"""
        if self.ws:
            await self.ws.close()
            self.ws = None
            logger.info("Disconnected from MCP server")
    
    async def initialize(self) -> Dict[str, Any]:
        """Initialize MCP session"""
        response = await self.send_request('initialize', {
            'protocolVersion': '2024-11-05',
            'capabilities': {
                'resources': {'subscribe': True},
                'tools': {'listChanged': True},
                'prompts': {'listChanged': True}
            },
            'clientInfo': {
                'name': 'Lokus Python MCP Client',
                'version': '1.0.0',
                'description': 'Python example client for Lokus MCP server'
            }
        })
        
        self.server_info = response.get('serverInfo', {})
        self.server_capabilities = response.get('capabilities', {})
        self.is_initialized = True
        
        logger.info(f"Initialized with server: {self.server_info.get('name', 'Unknown')}")
        logger.info(f"Server capabilities: {self.server_capabilities}")
        
        return response
    
    async def send_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send a JSON-RPC request and wait for response"""
        if not self.ws:
            raise RuntimeError("Not connected to MCP server")
        
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
        logger.debug(f"Sent request: {method} (id: {message_id})")
        
        try:
            # Wait for response with timeout
            response = await asyncio.wait_for(future, timeout=30.0)
            return response
        except asyncio.TimeoutError:
            self.pending_requests.pop(message_id, None)
            raise TimeoutError(f"Request {method} timed out")
    
    async def send_notification(self, method: str, params: Dict[str, Any] = None):
        """Send a JSON-RPC notification (no response expected)"""
        if not self.ws:
            raise RuntimeError("Not connected to MCP server")
        
        message = {
            'jsonrpc': '2.0',
            'method': method,
            'params': params or {}
        }
        
        await self.ws.send(json.dumps(message))
        logger.debug(f"Sent notification: {method}")
    
    async def _handle_messages(self):
        """Handle incoming WebSocket messages"""
        try:
            async for message in self.ws:
                data = json.loads(message)
                
                if 'id' in data:
                    # This is a response to a request
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
                    # This is a notification
                    await self._handle_notification(data['method'], data.get('params', {}))
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
        except Exception as e:
            logger.error(f"Error handling messages: {e}")
    
    async def _handle_notification(self, method: str, params: Dict[str, Any]):
        """Handle incoming notifications"""
        logger.debug(f"Received notification: {method}")
        
        # Call registered event handlers
        handlers = self.event_handlers.get(method, [])
        for handler in handlers:
            try:
                await handler(params)
            except Exception as e:
                logger.error(f"Error in event handler for {method}: {e}")
    
    def on(self, event: str, handler: Callable):
        """Register an event handler"""
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)
    
    # Resource methods
    async def list_resources(self, cursor: Optional[str] = None, 
                           resource_type: Optional[str] = None,
                           search: Optional[str] = None) -> Dict[str, Any]:
        """List available resources"""
        params = {}
        if cursor:
            params['cursor'] = cursor
        if resource_type:
            params['type'] = resource_type
        if search:
            params['search'] = search
        
        return await self.send_request('resources/list', params)
    
    async def read_resource(self, uri: str) -> Dict[str, Any]:
        """Read a single resource"""
        return await self.send_request('resources/read', {'uri': uri})
    
    async def read_resources(self, uris: List[str]) -> Dict[str, Any]:
        """Read multiple resources"""
        return await self.send_request('resources/read', {'uris': uris})
    
    async def subscribe_to_resource(self, uri: str) -> Dict[str, Any]:
        """Subscribe to resource changes"""
        return await self.send_request('resources/subscribe', {'uri': uri})
    
    async def unsubscribe_from_resource(self, uri: str) -> Dict[str, Any]:
        """Unsubscribe from resource changes"""
        return await self.send_request('resources/unsubscribe', {'uri': uri})
    
    # Tool methods
    async def list_tools(self, cursor: Optional[str] = None, 
                        category: Optional[str] = None) -> Dict[str, Any]:
        """List available tools"""
        params = {}
        if cursor:
            params['cursor'] = cursor
        if category:
            params['category'] = category
        
        return await self.send_request('tools/list', params)
    
    async def call_tool(self, name: str, arguments: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute a tool"""
        params = {'name': name}
        if arguments:
            params['arguments'] = arguments
        
        return await self.send_request('tools/call', params)
    
    # Prompt methods
    async def list_prompts(self) -> Dict[str, Any]:
        """List available prompt templates"""
        return await self.send_request('prompts/list', {})
    
    async def get_prompt(self, name: str, arguments: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get a rendered prompt template"""
        params = {'name': name}
        if arguments:
            params['arguments'] = arguments
        
        return await self.send_request('prompts/get', params)
    
    # Utility methods
    async def set_log_level(self, level: str) -> Dict[str, Any]:
        """Set server logging level"""
        return await self.send_request('logging/setLevel', {'level': level})
    
    async def get_completion(self, ref_type: str, name: str = None, 
                           argument_name: str = None, value: str = None) -> Dict[str, Any]:
        """Get completion suggestions"""
        params = {
            'ref': {'type': ref_type}
        }
        if name:
            params['ref']['name'] = name
        if argument_name and value:
            params['argument'] = {'name': argument_name, 'value': value}
        
        return await self.send_request('completion/complete', params)


# Example usage and demonstration
class LokusExplorer:
    """Example application that explores a Lokus workspace"""
    
    def __init__(self, client: LokusMCPClient):
        self.client = client
        
        # Register event handlers
        self.client.on('notifications/resources/updated', self._on_resource_updated)
        self.client.on('notifications/resources/list_changed', self._on_resource_list_changed)
        self.client.on('notifications/tools/list_changed', self._on_tool_list_changed)
    
    async def _on_resource_updated(self, params: Dict[str, Any]):
        """Handle resource update notifications"""
        logger.info(f"📄 Resource updated: {params.get('uri', 'unknown')}")
    
    async def _on_resource_list_changed(self, params: Dict[str, Any]):
        """Handle resource list change notifications"""
        logger.info("📋 Resource list changed")
    
    async def _on_tool_list_changed(self, params: Dict[str, Any]):
        """Handle tool list change notifications"""
        logger.info("🔧 Tool list changed")
    
    async def explore_workspace(self):
        """Explore the workspace and demonstrate MCP capabilities"""
        logger.info("🚀 Starting workspace exploration...")
        
        try:
            # 1. List all available resources
            logger.info("\n1️⃣ Discovering resources...")
            resources_response = await self.client.list_resources()
            resources = resources_response.get('resources', [])
            
            logger.info(f"Found {len(resources)} resources:")
            for resource in resources[:5]:  # Show first 5
                logger.info(f"  📄 {resource['name']} ({resource['type']}) - {resource['uri']}")
            
            if len(resources) > 5:
                logger.info(f"  ... and {len(resources) - 5} more")
            
            # 2. List available tools
            logger.info("\n2️⃣ Discovering tools...")
            tools_response = await self.client.list_tools()
            tools = tools_response.get('tools', [])
            
            logger.info(f"Found {len(tools)} tools:")
            for tool in tools[:5]:  # Show first 5
                logger.info(f"  🔧 {tool['name']} - {tool['description']}")
            
            # 3. Search for markdown files
            logger.info("\n3️⃣ Searching for markdown files...")
            search_result = await self.client.call_tool('search_files', {
                'query': '',
                'fileTypes': ['md'],
                'includeContent': False
            })
            
            if not search_result.get('isError', False):
                content = search_result['content'][0]['text']
                logger.info(f"Search results:\n{content[:500]}...")
            
            # 4. Read a specific file (if available)
            if resources:
                logger.info("\n4️⃣ Reading a resource...")
                first_file = next((r for r in resources if r['type'] == 'file'), None)
                
                if first_file:
                    try:
                        content_response = await self.client.read_resource(first_file['uri'])
                        content = content_response['contents'][0]['text']
                        
                        logger.info(f"Content of {first_file['name']}:")
                        logger.info(f"{content[:200]}...")
                        logger.info(f"Total characters: {len(content)}")
                        
                        # 5. Subscribe to this file for changes
                        logger.info("\n5️⃣ Subscribing to resource changes...")
                        await self.client.subscribe_to_resource(first_file['uri'])
                        logger.info(f"✅ Subscribed to {first_file['name']}")
                        
                    except Exception as e:
                        logger.error(f"Failed to read resource: {e}")
            
            # 6. List and try a prompt template
            logger.info("\n6️⃣ Exploring prompt templates...")
            prompts_response = await self.client.list_prompts()
            prompts = prompts_response.get('prompts', [])
            
            if prompts:
                logger.info(f"Found {len(prompts)} prompt templates:")
                for prompt in prompts:
                    logger.info(f"  💬 {prompt['name']} - {prompt['description']}")
                
                # Try the first prompt
                first_prompt = prompts[0]
                try:
                    prompt_response = await self.client.get_prompt(
                        first_prompt['name'],
                        {'content': 'This is a test content for the prompt template.'}
                    )
                    
                    logger.info(f"\nRendered prompt '{first_prompt['name']}':")
                    for message in prompt_response['messages']:
                        logger.info(f"  {message['role']}: {message['content']['text'][:100]}...")
                        
                except Exception as e:
                    logger.error(f"Failed to render prompt: {e}")
            
            # 7. Demonstrate file creation
            logger.info("\n7️⃣ Creating a test file...")
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            test_content = f"""# MCP Test File

Created by Python MCP client at {datetime.now().isoformat()}

This file demonstrates the MCP protocol capabilities:

- ✅ Resource discovery
- ✅ Tool execution  
- ✅ Real-time subscriptions
- ✅ Content creation

## Statistics
- Timestamp: {timestamp}
- Client: Lokus Python MCP Client
- Protocol: MCP 2024-11-05
"""
            
            try:
                create_result = await self.client.call_tool('create_file', {
                    'path': f'/workspace/mcp-test-{timestamp}.md',
                    'content': test_content
                })
                
                if not create_result.get('isError', False):
                    logger.info("✅ Test file created successfully")
                else:
                    logger.error(f"❌ Failed to create file: {create_result['content'][0]['text']}")
                    
            except Exception as e:
                logger.error(f"❌ Error creating file: {e}")
            
            logger.info("\n🎉 Workspace exploration completed!")
            
        except Exception as e:
            logger.error(f"❌ Error during exploration: {e}")
    
    async def interactive_mode(self):
        """Run in interactive mode for manual testing"""
        logger.info("\n🎮 Entering interactive mode...")
        logger.info("Commands: list-resources, list-tools, search <query>, read <uri>, quit")
        
        while True:
            try:
                command = input("\n> ").strip().lower()
                
                if command == 'quit':
                    break
                
                elif command == 'list-resources':
                    response = await self.client.list_resources()
                    for resource in response.get('resources', []):
                        print(f"  📄 {resource['name']} - {resource['uri']}")
                
                elif command == 'list-tools':
                    response = await self.client.list_tools()
                    for tool in response.get('tools', []):
                        print(f"  🔧 {tool['name']} - {tool['description']}")
                
                elif command.startswith('search '):
                    query = command[7:]
                    result = await self.client.call_tool('search_files', {
                        'query': query,
                        'includeContent': False
                    })
                    print(result['content'][0]['text'])
                
                elif command.startswith('read '):
                    uri = command[5:]
                    result = await self.client.read_resource(uri)
                    content = result['contents'][0]['text']
                    print(f"Content: {content[:500]}...")
                
                else:
                    print("Unknown command. Try: list-resources, list-tools, search <query>, read <uri>, quit")
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"Error: {e}")
        
        logger.info("👋 Exiting interactive mode")


async def main():
    """Main application entry point"""
    logger.info("🚀 Lokus MCP Python Client Example")
    
    # Get configuration from environment or use defaults
    websocket_url = os.getenv('LOKUS_MCP_URL', 'ws://localhost:3001/mcp')
    api_key = os.getenv('LOKUS_API_KEY')
    
    if not api_key:
        logger.warning("⚠️  No API key found. Set LOKUS_API_KEY environment variable for authentication")
    
    # Create and connect client
    client = LokusMCPClient(websocket_url=websocket_url, api_key=api_key)
    
    try:
        # Connect to server
        connected = await client.connect()
        if not connected:
            logger.error("❌ Failed to connect to MCP server")
            return 1
        
        # Create explorer
        explorer = LokusExplorer(client)
        
        # Check command line arguments
        if len(sys.argv) > 1 and sys.argv[1] == '--interactive':
            await explorer.interactive_mode()
        else:
            await explorer.explore_workspace()
            
            # Keep connection alive for a bit to see any notifications
            logger.info("\n⏱️  Waiting 10 seconds for any notifications...")
            await asyncio.sleep(10)
        
        return 0
        
    except KeyboardInterrupt:
        logger.info("\n👋 Shutting down...")
        return 0
    except Exception as e:
        logger.error(f"❌ Application error: {e}")
        return 1
    finally:
        await client.disconnect()


if __name__ == '__main__':
    # Run the application
    exit_code = asyncio.run(main())
    sys.exit(exit_code)