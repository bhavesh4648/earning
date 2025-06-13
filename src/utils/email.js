import nodemailer from "nodemailer";

const { NODE_MAILER_USER, NODE_MAILER_PASS, BASE_URL, NODE_MAILER_EMAIL_USER } =
  process.env;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use TLS
  auth: {
    user: NODE_MAILER_USER,
    pass: NODE_MAILER_PASS,
  },
});

const sendVerificationEmail = async (email, token) => {
  const url = `${BASE_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: NODE_MAILER_EMAIL_USER,
    to: email,
    subject: "verify Your Email",
    html: `<p>Click <a href="${url}">here </a> to verify your email.</p>`,
  });
};

export { sendVerificationEmail };
