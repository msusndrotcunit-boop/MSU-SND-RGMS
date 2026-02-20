async function sendEmail(to, subject, html, options = {}) {
  return { success: true, to, subject };
}

module.exports = { sendEmail };
