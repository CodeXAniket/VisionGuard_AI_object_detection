// Every successful response has the same shape: { success: true, data: ... }
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

module.exports = { sendSuccess };
