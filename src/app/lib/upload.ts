import multer from 'multer';
import path from 'path';
// import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils';
import httpStatus from 'http-status';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    let folderPath = './public';

    if (file.mimetype.startsWith('image')) {
      folderPath = './public/images';
    } else if (file.mimetype.startsWith('video')) {
      folderPath = './public/videos';
    } else if (file.mimetype === 'application/pdf') {
      folderPath = './public/documents';
    } else if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      folderPath = './public/spreadsheets';
    } else {
      callback(
        new AppError(
          httpStatus.BAD_REQUEST,
          'Only images, videos, PDFs, and Excel files are allowed'
        ),
        './public'
      );
      return;
    }

    // Check if the folder exists, if not, create it
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    callback(null, folderPath);
  },

  filename(_req, file, callback) {
    const fileExt = path.extname(file.originalname);
    const fileName = `${file.originalname
      .replace(fileExt, '')
      .toLocaleLowerCase()
      .split(' ')
      .join('-')}-${Date.now()}`;
    // .join('-')}-${uuidv4()}`;

    callback(null, fileName + fileExt);
  },
});

// File filter to validate file types
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  const allowedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  const allowedVideoTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
  ];
  const allowedDocTypes = ['application/pdf'];
  const allowedExcelTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  const allAllowedTypes = [
    ...allowedImageTypes,
    ...allowedVideoTypes,
    ...allowedDocTypes,
    ...allowedExcelTypes,
  ];

  if (allAllowedTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new AppError(
        httpStatus.BAD_REQUEST,
        'Only images, videos, PDFs, and Excel files are allowed'
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
    files: 5, // Maximum 5 files per request
  },
});

export default upload;
