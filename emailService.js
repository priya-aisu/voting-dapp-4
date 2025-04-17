const nodemailer = require('nodemailer');

// Configure Nodemailer transporter once
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL, // Your email address
        pass: process.env.EMAIL_PASS // Your email password
    }
});

// Generic function to send an email
const sendEmail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL,
        to: to,
        subject: subject,
        text: text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to: ${to}`);
    } catch (error) {
        console.error('Failed to send email:', error);
        throw new Error('Email sending failed');
    }
};

module.exports = { sendEmail };
