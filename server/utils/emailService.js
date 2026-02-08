const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text, html) => {
    try {
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASS;

        if (!user || !pass) {
            console.log('--- EMAIL SIMULATION ---');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Text: ${text}`);
            console.log('------------------------');
            return false;
        }

        const fromAddress = process.env.EMAIL_FROM || user;
        const replyToAddress = process.env.EMAIL_REPLY_TO || fromAddress;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass
            }
        });

        const mailOptions = {
            from: fromAddress,
            to,
            replyTo: replyToAddress,
            subject,
            text,
            html
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = { sendEmail };
