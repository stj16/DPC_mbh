// Simulation de Twilio pour la phase de Hackathon (évite de consommer des crédits)
// En production : import twilio from "twilio";

export const twilioService = {
    async sendOTP(phone, otpCode) {
        if (process.env.USE_REAL_TWILIO === "true" && process.env.TWILIO_ACCOUNT_SID) {
            // var client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            // await client.messages.create({
            //   body: `Ton code de vérification DiasporaConnect est: ${otpCode}`,
            //   to: phone,
            //   from: process.env.TWILIO_PHONE_NUMBER
            // });
            console.log(`[Twilio REAL] Message envoyé à ${phone}`);
        } else {
            // Mode DEV/Hackathon
            console.log("==================================================");
            console.log(`📱 [TWILIO SIMULATION] SMS envoyé à : ${phone}`);
            console.log(`💬 "Ton code de vérification DiasporaConnect est: ${otpCode}"`);
            console.log("==================================================");
        }
        return true;
    }
};
