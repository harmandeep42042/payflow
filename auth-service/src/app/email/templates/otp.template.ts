export function buildOtpEmailTemplate(
  firstName: string,
  otp: string,
  expiresInMinutes: number,
): string {
  const safeName = firstName.trim() || 'User';

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>Payflow OTP</title>
      </head>

      <body
        style="
          margin: 0;
          padding: 0;
          background-color: #f4f6f8;
          font-family: Arial, sans-serif;
          color: #1f2937;
        "
      >
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
        >
          <tr>
            <td align="center" style="padding: 40px 16px">
              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
                style="
                  max-width: 560px;
                  background-color: #ffffff;
                  border-radius: 12px;
                  overflow: hidden;
                  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
                "
              >
                <tr>
                  <td
                    style="
                      padding: 28px;
                      background-color: #111827;
                      color: #ffffff;
                      text-align: center;
                    "
                  >
                    <h1 style="margin: 0; font-size: 26px">
                      Payflow
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 32px">
                    <h2 style="margin-top: 0">
                      Verify your identity
                    </h2>

                    <p>Hello ${safeName},</p>

                    <p>
                      Use the following one-time password to continue:
                    </p>

                    <div
                      style="
                        margin: 28px 0;
                        padding: 18px;
                        background-color: #f3f4f6;
                        border-radius: 10px;
                        text-align: center;
                        font-size: 34px;
                        font-weight: 700;
                        letter-spacing: 8px;
                      "
                    >
                      ${otp}
                    </div>

                    <p>
                      This OTP will expire in
                      <strong>${expiresInMinutes} minutes</strong>.
                    </p>

                    <p>
                      Never share this OTP with anyone.
                    </p>

                    <p style="margin-bottom: 0">
                      Regards,<br />
                      Payflow Team
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
