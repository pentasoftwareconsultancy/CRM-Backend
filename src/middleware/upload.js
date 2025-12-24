import multer from "multer";

const storage = multer.diskStorage({}); // Use temporary storage

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
});

export default upload;