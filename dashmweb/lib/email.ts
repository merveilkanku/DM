import { fetchWithRetry } from '../utils/fetch';

export const sendEmail = async ({ to, subject, html, from }: { to: string | string[], subject: string, html: string, from?: string }) => {
  try {
    const response = await fetchWithRetry('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, subject, html, from }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send email';
      try {
        const errorData = await response.json();
        errorMessage = typeof errorData.error === 'object' 
          ? (errorData.error.message || JSON.stringify(errorData.error)) 
          : (errorData.error || errorMessage);
      } catch (e) {
        errorMessage = `Email server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (e) {
      return { success: true }; // Fallback if server returned 200 but no JSON
    }
  } catch (error: any) {
    console.error('Email sending failed:', error.message || error);
    // We don't want to break the app flow if email fails
    return null;
  }
};

export const sendOrderConfirmationEmail = async (order: any, userEmail: string) => {
  const itemsHtml = order.items.map((item: any) => `
    <li>${item.quantity}x ${item.name} - $${(item.price * item.quantity).toFixed(2)}</li>
  `).join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ea580c;">Merci pour votre commande !</h1>
      <p>Votre commande <strong>#${order.id.slice(0, 8)}</strong> a été reçue et est en cours de traitement.</p>
      
      <h3>Détails de la commande :</h3>
      <ul>
        ${itemsHtml}
      </ul>
      
      <p><strong>Total : $${order.totalAmount.toFixed(2)}</strong></p>
      
      <p>Vous recevrez une notification dès que votre commande sera prête.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">DashMeals - Votre service de livraison préféré.</p>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Confirmation de votre commande DashMeals #${order.id.slice(0, 8)}`,
    html
  });
};

export const sendOrderStatusUpdateEmail = async (order: any, userEmail: string, status: string) => {
  const statusMessages: Record<string, string> = {
    preparing: "est en cours de préparation 🍳",
    ready: "est prête ! 🛍️",
    delivering: "est en route 🛵",
    delivered: "a été livrée. Bon appétit ! 😋",
    completed: "est terminée. Merci de votre confiance ! ✨",
    cancelled: "a été annulée ❌"
  };

  const statusMessage = statusMessages[status] || `a changé de statut : ${status}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ea580c;">Mise à jour de votre commande</h1>
      <p>Votre commande <strong>#${order.id.slice(0, 8)}</strong> ${statusMessage}</p>
      
      <p>Vous pouvez suivre l'état de votre commande directement dans l'application.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">DashMeals - Votre service de livraison préféré.</p>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Mise à jour de votre commande DashMeals #${order.id.slice(0, 8)}`,
    html
  });
};

export const sendNewOrderNotificationToRestaurant = async (order: any, restaurantEmail: string, restaurantName: string) => {
  const itemsHtml = order.items.map((item: any) => `
    <li>${item.quantity}x ${item.name}</li>
  `).join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ea580c;">Nouvelle commande reçue !</h1>
      <p>Bonjour <strong>${restaurantName}</strong>,</p>
      <p>Vous avez reçu une nouvelle commande <strong>#${order.id.slice(0, 8)}</strong>.</p>
      
      <h3>Détails de la commande :</h3>
      <ul>
        ${itemsHtml}
      </ul>
      
      <p><strong>Total à percevoir : $${order.totalAmount.toFixed(2)}</strong></p>
      
      <p>Veuillez vous rendre sur votre tableau de bord pour accepter la commande et commencer la préparation.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">DashMeals Business - Gérez votre restaurant en toute simplicité.</p>
    </div>
  `;

  return sendEmail({
    to: restaurantEmail,
    subject: `[DashMeals] Nouvelle commande #${order.id.slice(0, 8)}`,
    html
  });
};

export const sendVerificationStatusEmail = async (restaurantName: string, ownerEmail: string, status: 'verified' | 'rejected') => {
  const isVerified = status === 'verified';
  const subject = isVerified ? "Félicitations ! Votre restaurant est vérifié" : "Mise à jour concernant votre demande de vérification";
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: ${isVerified ? '#10b981' : '#ef4444'};">${isVerified ? 'Compte Vérifié !' : 'Action Requise'}</h1>
      <p>Bonjour <strong>${restaurantName}</strong>,</p>
      <p>${isVerified 
        ? "Nous avons le plaisir de vous informer que votre établissement a été vérifié avec succès. Vous bénéficiez désormais du badge de confiance sur la plateforme." 
        : "Après examen de vos documents, nous ne pouvons pas valider votre compte pour le moment. Veuillez vérifier vos documents et soumettre une nouvelle demande."}</p>
      
      <p>Connectez-vous à votre tableau de bord pour plus de détails.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">L'équipe DashMeals Admin.</p>
    </div>
  `;

  return sendEmail({
    to: ownerEmail,
    subject: `[DashMeals] ${subject}`,
    html
  });
};

export const sendSupportReplyEmail = async (userName: string, userEmail: string, ticketSubject: string, replyMessage: string) => {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #ea580c;">Réponse à votre demande de support</h1>
      <p>Bonjour <strong>${userName}</strong>,</p>
      <p>Notre équipe a répondu à votre message concernant : <em>${ticketSubject}</em></p>
      
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #ea580c; margin: 20px 0;">
        ${replyMessage}
      </div>
      
      <p>Vous pouvez consulter la discussion complète dans l'application.</p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #666;">Support DashMeals.</p>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject: `[DashMeals] Réponse à votre demande : ${ticketSubject}`,
    html
  });
};
