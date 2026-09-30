const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { singleImage } = require('../middleware/upload');
const {
  createDetection,
  listDetections,
  getDetection,
  updateDetectionStatus,
  deleteDetection,
} = require('../controllers/detectionController');

const router = express.Router();

router.use(requireAuth);

router.post('/', singleImage('image'), createDetection);
router.get('/', listDetections);
router.get('/:id', getDetection);
router.patch('/:id', updateDetectionStatus);
router.delete('/:id', deleteDetection);

module.exports = router;
