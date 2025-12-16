const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_DIR = path.join(__dirname, 'storage');

// Ensure storage directory exists
fs.ensureDirSync(STORAGE_DIR);

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, STORAGE_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '.zip');
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Routes
app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'Lokus Plugin Registry' });
});

app.post('/api/v1/registry/publish', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const manifestStr = req.body.manifest;

        if (!file || !manifestStr) {
            return res.status(400).json({ message: 'Missing file or manifest' });
        }

        const manifest = JSON.parse(manifestStr);
        const { name, version } = manifest;

        console.log(`Received publish request for ${name}@${version}`);

        // Create plugin directory
        const pluginDir = path.join(STORAGE_DIR, name, version);
        await fs.ensureDir(pluginDir);

        // Move file to final destination
        const targetPath = path.join(pluginDir, 'package.zip');
        await fs.move(file.path, targetPath, { overwrite: true });

        // Save manifest
        await fs.writeJson(path.join(pluginDir, 'manifest.json'), manifest, { spaces: 2 });

        console.log(`Successfully published ${name}@${version}`);

        res.json({
            success: true,
            message: 'Published successfully',
            url: `http://localhost:${PORT}/plugins/${name}/${version}`
        });

    } catch (error) {
        console.error('Publish error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Registry running at http://localhost:${PORT}`);
});
