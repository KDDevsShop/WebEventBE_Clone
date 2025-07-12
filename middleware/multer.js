import multer from 'multer';

// Memory storage for cloud uploads
const memoryStorage = multer.memoryStorage();

// File filter to only allow images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// Create upload object with memory storage
const upload = multer({
    storage: memoryStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter
});

export default {
    single: (fieldName) => upload.single(fieldName),
    array: (fieldName, maxCount) => upload.array(fieldName, maxCount),
    fields: (fields) => upload.fields(fields)
};