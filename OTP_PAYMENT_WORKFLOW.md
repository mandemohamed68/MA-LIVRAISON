# Workflow Complet du Paiement OTP Direct (via la passerelle SAPPAY)

Ce document décrit en détail le cycle complet de paiement par **OTP (One-Time Password)** direct intégré au sein de l'application **Pancho Express** via la passerelle **Sappay** (pour Moov Money et Coris Money notamment).

---

## 📌 Architecture Globale

Le flux de paiement OTP est une transaction à deux phases conçue pour s'interfacer de manière sécurisée avec l'API Sappay via un **proxy backend** Node.js/Express. Le proxy masque les secrets de sécurité de l'API (clé secrète, jetons d'accès) et évite d'exposer les identifiants d'administration Sappay aux clients.

```
+------------+           +----------------------+           +----------------+
|  Frontend  | --------> |    Backend Proxy     | --------> |   API Sappay   |
| (Mobile/UI)|           |     (server.ts)      |           |  (Operator)    |
+------------+           +----------------------+           +----------------+
```

---

## 🔄 Étapes pas à pas du Workflow

### Étape 1 : Saisie de l'information (Client)
1. L'utilisateur sélectionne un mode de paiement de type **OTP** (ex: *Moov Money* ou *Coris Money* dans `PaymentModal.tsx`).
2. L'utilisateur saisit son numéro de téléphone mobile.

---

### Étape 2 : Initialisation de la Facture (Sappay Init)
Lorsque l'utilisateur soumet initialement le formulaire, le bouton déclenche `handleSappayInit()` du côté frontend et appelle l'API locale `/api/payment/sappay/init`.

#### 💻 Code Backend Déployé (`/api/payment/sappay/init`)
```typescript
app.post("/api/payment/sappay/init", async (req, res) => {
  try {
    const { amount, note, email } = req.body;
    const token = await getSappayToken();

    const invoiceResponse = await fetch(`${SAPPAY_BASE_PUBLIC}/invoice/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        type: "SIMPLE",
        customer: {
          email: email || "client@pancho.app",
          country: 1
        },
        amount: amount.toString(),
        note: note || `Livraison PANCHO #${Math.random().toString(36).substr(2, 5)}`
      }),
    });

    let responseText = "";
    try {
      responseText = await invoiceResponse.text();
    } catch (e) {
      responseText = "Impossible de lire la réponse.";
    }

    if (!invoiceResponse.ok) {
      throw new Error(`Sappay Invoice Creation Failed (${invoiceResponse.status}): ${responseText.substring(0, 500)}`);
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Sappay response was not valid JSON: ${responseText.substring(0, 500)}`);
    }
    const invoiceId = findInvoiceId(responseData);

    if (!invoiceId) {
      return res.status(400).json({ error: "Could not retrieve Invoice ID from Sappay", details: responseData });
    }

    res.json({ 
      invoice_id: invoiceId, 
      access_token: token,
      status: responseData.status || "PENDING"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### Étape 3 : Demande du Code OTP (Sappay Get OTP)
Une fois la facture initialisée et l'identifiant de facture (`invoice_id`) récupéré, si l'opérateur nécessite un jeton OTP (comme Moov et Coris au Burkina Faso), l'application appelle automatiquement `/api/payment/sappay/get-otp`.

#### 💻 Code Backend Déployé (`/api/payment/sappay/get-otp`)
```typescript
app.post("/api/payment/sappay/get-otp", async (req, res) => {
  try {
    const { customer_msisdn, invoice_id, payment_processor_id, access_token } = req.body;
    
    const headers: any = {
      "Content-Type": "application/json"
    };
    if (access_token) {
      headers["Authorization"] = `Bearer ${access_token}`;
    }

    const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/get-otp/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer_msisdn: normalizePhoneNumberSappay(customer_msisdn),
        invoice_id,
        payment_processor_id
      }),
    });

    let responseText = "";
    try {
      responseText = await response.text();
    } catch (e) {
      responseText = "Impossible de lire la réponse.";
    }

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: "Sappay OTP Error",
        details: responseText.substring(0, 500)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: "Format de réponse OTP invalide" });
    }
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```
*Note : Sappay renvoie souvent un `trans_id` dans la réponse nécessaire pour finaliser la validation.*

---

### Étape 4 : Saisie de l'OTP et validation finale (Sappay Perform)
L'utilisateur reçoit l'OTP via SMS sur son téléphone (ou génère un code selon la méthode opérateur), puis tape le code de sécurité à l'écran. Lors de la soumission, l'application effectue l'appel final de validation vers `/api/payment/sappay/perform`.

#### 💻 Code Backend Déployé (`/api/payment/sappay/perform`)
```typescript
app.post("/api/payment/sappay/perform", async (req, res) => {
  try {
    const { invoice_id, payment_processor_id, customer_msisdn, otp, trans_id, access_token } = req.body;
    
    const payload: any = {
      invoice_id,
      payment_processor_id,
      customer_msisdn: normalizePhoneNumberSappay(customer_msisdn),
      otp: otp.toString()
    };

    if (trans_id) {
      payload.trans_id = trans_id;
    }

    const headers: any = {
      "Content-Type": "application/json"
    };
    if (access_token) {
      headers["Authorization"] = `Bearer ${access_token}`;
    }

    const response = await fetch(`${SAPPAY_BASE_CHECKOUT}/perform/`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    let responseText = "";
    try {
      responseText = await response.text();
    } catch (e) {
      responseText = "Impossible de lire la réponse.";
    }

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: "Sappay Perform Error",
        details: responseText.substring(0, 500)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ error: "Format de réponse perform invalide" });
    }
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📱 Orchestration Côté Frontend (`PaymentModal.tsx`)

Le fichier `PaymentModal.tsx` gère la transition des étapes (`sappayStep`) de la façon suivante :

- **Étape 'init' (Saisie mobile)** : Déclenche `handleSappayInit()` -> Fait l'appel proxy d'init, récupère le token d'accès temporaire et l'ID de facture. Puis selon le cas, procède au déclenchement d'OTP automatique chez l'opérateur. Transitionne l'état à `otp`.
- **Étape 'otp' (Saisie code)** : L'utilisateur entre l'OTP en provenance du SMS. Soumet l'action finale `handlePayment()` qui appelle `perform`.
- **Analyse du statut de retour** :
  - Si le statut de retour de Sappay est `SUCCESS`, le paiement est immédiatement approuvé côté client.
  - Si le statut est `PENDING`, le paiement est mis en attente pour validation administrative ou traitement asynchrone (Notification de paiement en arrière-plan d'administration).
  - En cas d'erreur de transaction, le code fournit des messages contextuels explicites et des avertissements fluides.

---

## 🛠️ Configuration des Identifiants pour le Panneau d'Administration

Les informations secrètes de l'API Sappay peuvent être modifiées à tout moment via la base de données ou directement depuis l'onglet de configuration de l'**Espace Administrateur** :

1. **Sappay Client ID**
2. **Sappay Client Secret**
3. **Sappay Username**
4. **Sappay Password**

Ces valeurs se rechargent dynamiquement lors de la négociation d'un nouveau jeton d'authentification Sappay au démarrage de chaque cycle d'initialisation de paiement direct.
