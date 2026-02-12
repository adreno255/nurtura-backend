export function getEmailResetNotificationTemplate(): string {
    return `
        <div
            style="
                font-family: Arial, sans-serif;
                font-size: 14px;
                color: #333333;
                line-height: 1.5;
                background-color: white;
                padding: 20px;
            "
        >
            <center>
                <img src="cid:logo" style="width: 30px; padding: 30px" alt="Nurtura Logo" />
            </center>

            <div
                style="
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: white;
                    border-radius: 8px;
                    overflow: hidden;
                "
            >
                <div style="background-color: #384236; color: white; padding: 45px 35px">
                    <h1
                        style="
                            font-size: 32px;
                            margin: 0;
                            font-weight: bold;
                            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
                        "
                    >
                        LoamTech Solutions
                    </h1>
                    <p
                        style="
                            font-size: 14px;
                            margin: 0;
                            color: white;
                            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
                        "
                    >
                        From Seed to Bloom, We've Got You Covered
                    </p>
                </div>
                <div style="padding: 30px 35px">
                    <p style="padding-top: 5px">
                        We’re writing to let you know that the
                        <b>email address associated with your Nurtura account was recently changed</b>.
                    </p>
                    <p style="margin-top: 15px">
                        If you made this change, no further action is needed. Your account is up to date.
                    </p>
                    <p style="margin-top: 15px">
                        <b>If you did NOT request this change</b>, your account security may be at risk. We
                        strongly recommend that you contact our support team immediately to secure your
                        account.
                    </p>
                    <p style="margin-top: 20px">
                        For your protection, Nurtura will never ask for your password, login codes, or
                        personal details via email. Please stay alert for phishing attempts.
                    </p>
                    <p style="margin-top: 30px">Thanks for being part of Nurtura!</p>
                    <p style="margin-bottom: 40px">
                        Best Regards,<br />
                        <b style="color: #19350c">LoamTech Team</b>
                    </p>
                </div>
                <div
                    style="
                        text-align: center;
                        padding: 25px 20px;
                        background-color: #f9f9f9;
                        border-top: 1px solid #eaeaea;
                    "
                >
                    <div style="margin-bottom: 15px">
                        <a
                            href="https://www.facebook.com/profile.php?id=61580252422436"
                            style="text-decoration: none; color: #19350c; font-weight: bold"
                        >
                            <img src="cid:facebook" style="width: 30px; padding: 2px" alt="Facebook" />
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #777777; margin: 1px 0">
                        © 2025 LoamTech Solutions. All rights reserved.
                    </p>
                    <p style="font-size: 10px; color: #999999; margin-top: 15px">
                        You are receiving this email because the email address on your Nurtura account was
                        changed. If this wasn’t you, please contact support as soon as possible.
                    </p>
                </div>
            </div>
        </div>
  `;
}
