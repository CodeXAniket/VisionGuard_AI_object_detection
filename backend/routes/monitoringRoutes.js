const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { singleImage } = require('../middleware/upload');
const { getConfig, updateConfig, getClasses, getHealth, detectFrame } = require('../controllers/monitoringController');

const router = express.Router();

router.use(requireAuth);

router.get('/config', getConfig);
router.put('/config', updateConfig);
router.get('/classes', getClasses);
router.get('/health', getHealth);
router.post('/detect', singleImage('frame'), detectFrame);

module.exports = router;
