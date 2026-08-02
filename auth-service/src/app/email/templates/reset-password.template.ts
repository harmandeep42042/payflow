export function buildResetPasswordEmailTemplate(
  firstName: string,
  resetToken: string,
): string {
  const safeName = firstName.trim() || 'User';

  return `
    <!DOCTYPE html>
    <html lang="en">
      <body
        style="
          margin: 0;
          padding: 32px;
          background-color: #f4f6f8;
          font-family: Arial, sans-serif;
          color: #1f2937;
        "
      >
        <div
          style="
            max-width: 560px;
            margin: 0 auto;
            padding: 32px;
            background-color: #ffffff;
            border-radius: 12px;
          "
        >
          <h1>Reset your Payflow password</h1>

          <p>Hello ${safeName},</p>

          <p>
            Use this password reset token:
          </p>

          <div
            style="
              margin: 24px 0;
              padding: 16px;
              background-color: #f3f4f6;
              border-radius: 8px;
              word-break: break-all;
              font-family: monospace;
            "
          >
            ${resetToken}
          </div>

          <p>
            Ignore this email if you did not request a password reset.
          </p>

          <p>
            Regards,<br />
            Payflow Team
          </p>
        </div>
      </body>
    </html>
  `;
}
