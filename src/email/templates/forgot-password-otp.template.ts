export function getForgotPasswordOtpTemplate(code: string, expiryTime: string): string {
    const codeDigits = code
        .split('')
        .map(
            (digit) => `
      <td style="
        background-color: #F3F5F3;
        color: #10241B;
        font-size: 18px;
        font-weight: bold;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid #E0E4E0;
        margin: 0 3px;
        text-align: center;
        min-width: 28px;
      ">${digit}</td>
    `,
        )
        .join('');

    return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333333; line-height: 1.5; background-color: white; padding: 20px;">
      <center><img src="cid:logo" style="width: 30px; padding: 30px;" alt="Nurtura Logo"></center>
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden;"> 
        <div style="background-color: #384236; color: white; padding: 45px 35px;">
          <h1 style="font-size: 32px; margin: 0; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);">LoamTech Solutions</h1>
          <p style="font-size: 14px; margin: 0; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);">From Seed to Bloom, We've Got You Covered</p>
        </div>
        <div style="padding: 30px 35px;">       
          <p style="padding-top: 5px;">
            To reset your Nurtura account password, please use the One Time Password (OTP) below.
            Enter this code in the password reset page to proceed.
          </p>
          <center>
            <table cellspacing="6" cellpadding="0" border="0" style="margin: 20px 0;">
              <tr>
                ${codeDigits}
              </tr>
            </table>
          </center>
          <p style="margin-bottom: 25px;">OTP will expire in <b>15 minutes</b> at ${expiryTime}.</p>
          <p style="margin-top: 20px;">
            Do not share this OTP with anyone. If you didn't make this request, you can safely ignore this email.
            <br />Nurtura will never contact you about this email or ask for any login codes or links. Beware of phishing scams.
          </p>
          <p style="margin-top: 30px;">Thanks for visiting Nurtura!</p>
          <p style="margin-bottom: 40px;">
            Best Regards,<br>
            <b style="color: #19350C;">LoamTech Team</b>
          </p>
        </div>
        <div style="text-align: center; padding: 25px 20px; background-color: #f9f9f9; border-top: 1px solid #eaeaea;">
          <div style="margin-bottom: 15px;">
            <a href="https://www.facebook.com/profile.php?id=61580252422436" style="margin: 0 0px; text-decoration: none; color: #19350C; font-weight: bold;">
              <img src="cid:facebook" style="width: 30px; padding: 2px;" alt="Facebook">
            </a>
          </div>
          <p style="font-size: 12px; color: #777777; margin: 1px 0;">© 2025 LoamTech Solutions. All rights reserved.</p>
          <p style="font-size: 10px; color: #999999; margin-top: 15px;">
            You are receiving this email because a password reset was requested for your Nurtura account.
            By continuing, you agree to our Terms of Use and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  `;
}
