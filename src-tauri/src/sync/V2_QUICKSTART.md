# Iroh V2 Quick Start Guide

## Enabling V2

### For New Installations
V2 is automatically enabled for new installations (no existing `.lokus/iroh` directory).

### For Existing Installations

#### Option 1: Environment Variable
```bash
# Windows
set LOKUS_USE_IROH_V2=true
npm run tauri dev

# macOS/Linux
LOKUS_USE_IROH_V2=true npm run tauri dev
```

#### Option 2: Migration Command
In the app preferences, run:
```javascript
await invoke('iroh_migrate_to_v2', { workspacePath: currentWorkspace });
```

## Verifying V2 is Active

```javascript
const version = await invoke('iroh_get_version');
console.log(`Using Iroh V${version}`); // Should print "Using Iroh V2"
```

## Using Force Sync for 300+ Files

The V2 implementation includes an optimized "Force Sync All" command:

```javascript
// In Preferences.jsx, add this button
<button onClick={async () => {
  try {
    setLoading(true);
    const result = await invoke('iroh_force_sync_all');
    console.log('Force sync result:', result);
    // Result includes: "Sync completed: X files uploaded, Y files downloaded, Z ms"
  } catch (error) {
    console.error('Force sync failed:', error);
  } finally {
    setLoading(false);
  }
}}>
  Force Sync All Files (V2)
</button>
```

## Monitoring Sync Progress

V2 provides real-time metrics:

```javascript
// Get sync metrics
const metrics = await invoke('iroh_get_metrics');
console.log('Sync metrics:', metrics);
// {
//   files_scanned: 300,
//   files_uploaded: 150,
//   files_downloaded: 150,
//   bytes_uploaded: 104857600,
//   bytes_downloaded: 104857600,
//   errors_count: 0,
//   conflicts_count: 0,
//   last_sync_duration_ms: 30000
// }
```

## Configuration Options

```javascript
// Configure V2 sync behavior
await invoke('iroh_configure_sync', {
  config: {
    max_concurrent_ops: 20,      // Increase for faster sync
    max_memory_mb: 1024,         // Increase for large files
    chunk_size: 8388608,         // 8MB chunks
    retry_attempts: 5,           // More retries for unstable networks
    batch_size: 100,             // Larger batches for many files
    enable_compression: true,     // Reduce bandwidth usage
    enable_encryption: true,      // Secure transfers
    conflict_resolution: 'LastWriteWins'
  }
});
```

## Troubleshooting

### Still Only Syncing 5 Files?

1. **Check Version**: Ensure V2 is active
   ```javascript
   const version = await invoke('iroh_get_version');
   if (version !== '2') {
     console.error('Still using V1! Enable V2 first.');
   }
   ```

2. **Force Full Scan**: Use the force sync command
   ```javascript
   await invoke('iroh_force_sync_all');
   ```

3. **Check Metrics**: Monitor what's happening
   ```javascript
   const metrics = await invoke('iroh_get_metrics');
   console.log(`Scanned: ${metrics.files_scanned}, Errors: ${metrics.errors_count}`);
   ```

4. **Review Logs**: Check the console for detailed sync logs

### Migration Issues

If migration fails:
```javascript
try {
  const result = await invoke('iroh_migrate_to_v2', { 
    workspacePath: currentWorkspace 
  });
  console.log('Migration result:', result);
} catch (error) {
  console.error('Migration failed:', error);
  // V2 will create fresh state if migration fails
}
```

## Performance Tips

1. **For 300+ Files**: Increase concurrent operations
   ```javascript
   await invoke('iroh_configure_sync', {
     config: { max_concurrent_ops: 30 }
   });
   ```

2. **For Large Files**: Increase memory limit
   ```javascript
   await invoke('iroh_configure_sync', {
     config: { max_memory_mb: 2048 }
   });
   ```

3. **For Slow Networks**: Enable compression
   ```javascript
   await invoke('iroh_configure_sync', {
     config: { enable_compression: true }
   });
   ```

## Frontend Integration Example

```jsx
// Enhanced sync status component
function SyncStatusV2() {
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [statusData, metricsData] = await Promise.all([
          invoke('iroh_sync_status'),
          invoke('iroh_get_metrics')
        ]);
        setStatus(statusData);
        setMetrics(metricsData);
      } catch (error) {
        console.error('Failed to fetch sync data:', error);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (!metrics) return null;
  
  return (
    <div className="sync-status-v2">
      <h3>Sync Status (V2)</h3>
      <div>Files: {metrics.files_scanned}</div>
      <div>Uploaded: {metrics.files_uploaded} ({formatBytes(metrics.bytes_uploaded)})</div>
      <div>Downloaded: {metrics.files_downloaded} ({formatBytes(metrics.bytes_downloaded)})</div>
      <div>Errors: {metrics.errors_count}</div>
      <div>Last sync: {metrics.last_sync_duration_ms}ms</div>
    </div>
  );
}
```

## Rollback to V1

If needed, you can rollback to V1:
```bash
# Remove V2 environment variable
unset LOKUS_USE_IROH_V2

# Or set to false
LOKUS_USE_IROH_V2=false npm run tauri dev
```

The V1 state is preserved during migration, so your sync will continue working.