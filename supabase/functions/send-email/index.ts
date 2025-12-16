import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userId: string;
  type: string;
  data: Record<string, unknown>;
}

// Email template functions
function getWorkOrderCompletedHtml(data: {
  woNumber: string;
  productType: string;
  completedAt: string;
  completedBy?: string;
  itemCount: number;
  language: string;
}): string {
  const isNl = data.language === 'nl';
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f9fc; margin: 0; padding: 20px; }
    .container { background: #fff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .logo { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; }
    .content { padding: 32px; }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    .message { color: #525f7f; font-size: 16px; margin: 0 0 24px; }
    .details { background: #f6f9fc; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .detail-row { color: #1a1a2e; font-size: 14px; line-height: 1.8; margin: 0; }
    .label { color: #8898aa; font-weight: 500; }
    .button { display: inline-block; background: #1a1a2e; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }
    .footer { padding: 32px; border-top: 1px solid #e6ebf1; }
    .footer-text { color: #8898aa; font-size: 14px; margin: 0 0 8px; }
    .footer-sub { color: #b4b4b4; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><p class="logo">RHOSONICS</p></div>
    <div class="content">
      <h1>${isNl ? 'Werkorder Voltooid' : 'Work Order Completed'}</h1>
      <p class="message">${isNl ? 'De volgende werkorder is succesvol afgerond:' : 'The following work order has been successfully completed:'}</p>
      <div class="details">
        <p class="detail-row"><span class="label">${isNl ? 'Werkorder' : 'Work Order'}:</span> ${data.woNumber}</p>
        <p class="detail-row"><span class="label">${isNl ? 'Producttype' : 'Product Type'}:</span> ${data.productType}</p>
        <p class="detail-row"><span class="label">${isNl ? 'Voltooid Op' : 'Completed At'}:</span> ${data.completedAt}</p>
        ${data.completedBy ? `<p class="detail-row"><span class="label">${isNl ? 'Voltooid Door' : 'Completed By'}:</span> ${data.completedBy}</p>` : ''}
        <p class="detail-row"><span class="label">${isNl ? 'Geproduceerde Items' : 'Items Produced'}:</span> ${data.itemCount}</p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Rhosonics Production System</p>
      <p class="footer-sub">${isNl ? 'Dit is een automatische melding. Reageer niet op deze email.' : 'This is an automated notification. Please do not reply to this email.'}</p>
    </div>
  </div>
</body>
</html>`;
}

function getWorkOrderCancelledHtml(data: {
  woNumber: string;
  productType: string;
  cancelledAt: string;
  cancelledBy?: string;
  reason?: string;
  language: string;
}): string {
  const isNl = data.language === 'nl';
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f9fc; margin: 0; padding: 20px; }
    .container { background: #fff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .logo { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; }
    .content { padding: 32px; }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    .message { color: #525f7f; font-size: 16px; margin: 0 0 24px; }
    .details { background: #fff5f5; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #e53e3e; }
    .detail-row { color: #1a1a2e; font-size: 14px; line-height: 1.8; margin: 0; }
    .label { color: #8898aa; font-weight: 500; }
    .reason { background: #fff; padding: 12px; border-radius: 4px; margin-top: 12px; }
    .footer { padding: 32px; border-top: 1px solid #e6ebf1; }
    .footer-text { color: #8898aa; font-size: 14px; margin: 0 0 8px; }
    .footer-sub { color: #b4b4b4; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><p class="logo">RHOSONICS</p></div>
    <div class="content">
      <h1>${isNl ? 'Werkorder Geannuleerd' : 'Work Order Cancelled'}</h1>
      <p class="message">${isNl ? 'De volgende werkorder is geannuleerd:' : 'The following work order has been cancelled:'}</p>
      <div class="details">
        <p class="detail-row"><span class="label">${isNl ? 'Werkorder' : 'Work Order'}:</span> ${data.woNumber}</p>
        <p class="detail-row"><span class="label">${isNl ? 'Producttype' : 'Product Type'}:</span> ${data.productType}</p>
        <p class="detail-row"><span class="label">${isNl ? 'Geannuleerd Op' : 'Cancelled At'}:</span> ${data.cancelledAt}</p>
        ${data.cancelledBy ? `<p class="detail-row"><span class="label">${isNl ? 'Geannuleerd Door' : 'Cancelled By'}:</span> ${data.cancelledBy}</p>` : ''}
        ${data.reason ? `<div class="reason"><span class="label">${isNl ? 'Reden' : 'Reason'}:</span><br/>${data.reason}</div>` : ''}
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Rhosonics Production System</p>
      <p class="footer-sub">${isNl ? 'Dit is een automatische melding. Reageer niet op deze email.' : 'This is an automated notification. Please do not reply to this email.'}</p>
    </div>
  </div>
</body>
</html>`;
}

function getLowStockAlertHtml(data: {
  materialName: string;
  currentQuantity: number;
  reorderPoint: number;
  unit: string;
  language: string;
  isOutOfStock?: boolean;
}): string {
  const isNl = data.language === 'nl';
  const isOutOfStock = data.isOutOfStock || data.currentQuantity <= 0;
  const borderColor = isOutOfStock ? '#e53e3e' : '#dd6b20';
  const bgColor = isOutOfStock ? '#fff5f5' : '#fffaf0';
  const valueColor = isOutOfStock ? '#e53e3e' : '#dd6b20';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f9fc; margin: 0; padding: 20px; }
    .container { background: #fff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .logo { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; }
    .content { padding: 32px; }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    .message { color: #525f7f; font-size: 16px; margin: 0 0 24px; }
    .details { background: ${bgColor}; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${borderColor}; }
    .material-name { color: #1a1a2e; font-size: 18px; font-weight: 600; margin: 0 0 12px; }
    .detail-row { color: #1a1a2e; font-size: 14px; line-height: 1.8; margin: 0; }
    .label { color: #8898aa; font-weight: 500; }
    .value { color: ${valueColor}; font-weight: 600; }
    .footer { padding: 32px; border-top: 1px solid #e6ebf1; }
    .footer-text { color: #8898aa; font-size: 14px; margin: 0 0 8px; }
    .footer-sub { color: #b4b4b4; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><p class="logo">RHOSONICS</p></div>
    <div class="content">
      <h1>${isOutOfStock ? (isNl ? '⚠️ Niet op Voorraad' : '⚠️ Out of Stock') : (isNl ? 'Lage Voorraad Melding' : 'Low Stock Alert')}</h1>
      <p class="message">${isOutOfStock 
        ? (isNl ? 'Het volgende materiaal is niet meer op voorraad. Directe actie is vereist:' : 'The following material is now out of stock. Immediate action is required:')
        : (isNl ? 'Het volgende materiaal raakt op en moet mogelijk opnieuw worden besteld:' : 'The following material is running low and may need to be reordered:')}</p>
      <div class="details">
        <p class="material-name">${data.materialName}</p>
        <p class="detail-row"><span class="label">${isNl ? 'Huidige Voorraad' : 'Current Stock'}:</span> <span class="value">${data.currentQuantity} ${data.unit}</span></p>
        <p class="detail-row"><span class="label">${isNl ? 'Bestelpunt' : 'Reorder Point'}:</span> ${data.reorderPoint} ${data.unit}</p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Rhosonics Production System</p>
      <p class="footer-sub">${isNl ? 'Dit is een automatische melding. Reageer niet op deze email.' : 'This is an automated notification. Please do not reply to this email.'}</p>
    </div>
  </div>
</body>
</html>`;
}

function getMentionHtml(data: {
  mentionedBy: string;
  context: string;
  content: string;
  language: string;
}): string {
  const isNl = data.language === 'nl';
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f9fc; margin: 0; padding: 20px; }
    .container { background: #fff; max-width: 600px; margin: 0 auto; border-radius: 8px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .logo { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; }
    .content { padding: 32px; }
    h1 { color: #1a1a2e; font-size: 24px; margin: 0 0 24px; }
    .message { color: #525f7f; font-size: 16px; margin: 0 0 24px; }
    .quote { background: #f6f9fc; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #5469d4; font-style: italic; color: #1a1a2e; }
    .footer { padding: 32px; border-top: 1px solid #e6ebf1; }
    .footer-text { color: #8898aa; font-size: 14px; margin: 0 0 8px; }
    .footer-sub { color: #b4b4b4; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><p class="logo">RHOSONICS</p></div>
    <div class="content">
      <h1>${isNl ? 'Je bent genoemd' : 'You were mentioned'}</h1>
      <p class="message"><strong>${data.mentionedBy}</strong> ${isNl ? 'heeft je genoemd in' : 'mentioned you in'} <strong>${data.context}</strong></p>
      <div class="quote">${data.content}</div>
    </div>
    <div class="footer">
      <p class="footer-text">Rhosonics Production System</p>
      <p class="footer-sub">${isNl ? 'Dit is een automatische melding. Reageer niet op deze email.' : 'This is an automated notification. Please do not reply to this email.'}</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, type, data }: EmailRequest = await req.json();
    console.log(`Processing email request: type=${type}, userId=${userId}`);

    // Get user profile and email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser?.user?.email) {
      console.error("Failed to get user email:", authError);
      return new Response(
        JSON.stringify({ error: "User not found or no email" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, language, notification_prefs")
      .eq("id", userId)
      .single();

    // Check if user has email notifications enabled
    const notificationPrefs = profile?.notification_prefs as Record<string, boolean> | null;
    if (!notificationPrefs?.email) {
      console.log(`User ${userId} has email notifications disabled`);
      return new Response(
        JSON.stringify({ message: "Email notifications disabled for user" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = authUser.user.email;
    const language = profile?.language || "en";

    let html: string;
    let subject: string;

    switch (type) {
      case "work_order_completed": {
        const typedData = data as {
          woNumber: string;
          productType: string;
          completedAt: string;
          completedBy?: string;
          itemCount: number;
        };
        subject = language === "nl" ? `Werkorder ${typedData.woNumber} Voltooid` : `Work Order ${typedData.woNumber} Completed`;
        html = getWorkOrderCompletedHtml({ ...typedData, language });
        break;
      }

      case "work_order_cancelled": {
        const typedData = data as {
          woNumber: string;
          productType: string;
          cancelledAt: string;
          cancelledBy?: string;
          reason?: string;
        };
        subject = language === "nl" ? `Werkorder ${typedData.woNumber} Geannuleerd` : `Work Order ${typedData.woNumber} Cancelled`;
        html = getWorkOrderCancelledHtml({ ...typedData, language });
        break;
      }

      case "low_stock_alert": {
        const typedData = data as {
          materialName: string;
          currentQuantity: number;
          reorderPoint: number;
          unit: string;
        };
        subject = language === "nl" ? `Lage Voorraad: ${typedData.materialName}` : `Low Stock Alert: ${typedData.materialName}`;
        html = getLowStockAlertHtml({ ...typedData, language, isOutOfStock: false });
        break;
      }

      case "material_out_of_stock": {
        const typedData = data as {
          materialName: string;
          unit: string;
        };
        subject = language === "nl" ? `⚠️ Niet op Voorraad: ${typedData.materialName}` : `⚠️ Out of Stock: ${typedData.materialName}`;
        html = getLowStockAlertHtml({ 
          materialName: typedData.materialName,
          currentQuantity: 0,
          reorderPoint: 0,
          unit: typedData.unit,
          language,
          isOutOfStock: true 
        });
        break;
      }

      case "user_mentioned": {
        const typedData = data as {
          mentionedBy: string;
          context: string;
          content: string;
        };
        subject = language === "nl" ? `${typedData.mentionedBy} heeft je genoemd` : `${typedData.mentionedBy} mentioned you`;
        html = getMentionHtml({ ...typedData, language });
        break;
      }

      default:
        console.error(`Unknown email type: ${type}`);
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${type}` }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }

    // Send email via Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Rhosonics <notifications@resend.dev>",
      to: [userEmail],
      subject,
      html,
    });

    if (emailError) {
      console.error("Failed to send email:", emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Email sent successfully: ${emailResult?.id}`);
    return new Response(
      JSON.stringify({ success: true, emailId: emailResult?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
