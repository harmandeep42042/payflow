export function buildWelcomeEmailTemplate(
  firstName: string,
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
          <h1>Welcome to Payflow</h1>

          <p>Hello ${safeName},</p>

          <p>
            Your Payflow account has been created successfully.
          </p>

          <p>
            You can now securely access wallet and payment services.
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
