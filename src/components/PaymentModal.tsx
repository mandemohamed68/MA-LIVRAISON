import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Smartphone, Landmark, CreditCard, Wallet, Clock, CheckCircle, AlertCircle, Loader2, ArrowLeft, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// --- CUSTOM ICONS ---
// Note: Pour ajouter vos propres logos, déposez les fichiers orange.png, moov.png, etc. dans /public/payments/
// Le code vérifiera si une image existe sinon il utilisera l'icône par défaut.

const OrangeMoneyIcon = ({ className }: { className?: string }) => (
  <div className={cn("w-full h-full bg-white border-2 border-slate-900 rounded-xl relative overflow-hidden flex", className)}>
     <div className="w-1/2 bg-slate-900 h-full flex items-center justify-center"><span className="text-white font-black text-xl leading-none">&gt;</span></div>
     <div className="w-1/2 bg-[#FF7900] h-full flex items-center justify-center"><span className="text-white font-black text-xl leading-none">&lt;</span></div>
  </div>
);

const MoovMoneyIcon = ({ className }: { className?: string }) => (
  <div className={cn("w-full h-full bg-[#F26C23] rounded-[9px] rotate-45 flex items-center justify-center relative overflow-hidden shadow-sm", className)}>
     <div className="rotate-[-45deg] flex flex-col items-center justify-center">
        <span className="text-[#005C9A] font-black text-[9px] -mb-1">MOOV</span>
        <span className="text-white font-bold text-[8px]">Money</span>
     </div>
  </div>
);

const TelecelMoneyIcon = ({ className }: { className?: string }) => (
   <div className={cn("w-full h-full bg-white border-2 border-[#1B4086] rounded-xl flex flex-col items-center justify-center gap-0.5", className)}>
      <div className="flex w-full items-center justify-center gap-1">
        <div className="w-2.5 h-2.5 bg-[#1B4086] rounded-tl-sm rounded-br-sm"></div>
        <div className="w-2.5 h-2.5 bg-[#00A1E0] rounded-tl-sm rounded-br-sm"></div>
      </div>
   </div>
);

const CorisMoneyIcon = ({ className }: { className?: string }) => (
   <div className={cn("w-full h-full bg-[#009ED6] rounded-xl flex items-center justify-center relative shadow-sm", className)}>
      <svg viewBox="0 0 40 40" className="w-[80%] h-[80%]">
        <path d="M 28 8 Q 12 8 10 20 Q 8 32 20 32 Q 28 32 30 24" fill="none" stroke="#FFEE00" strokeWidth="4" strokeLinecap="round" />
      </svg>
   </div>
);

const PaymentIcon = ({ id, icon: Icon, isCustomImg, className, bg, color, selected }: any) => {
  const [hasImage, setHasImage] = useState(false);
  const logoUrl = `/payments/${id.replace('_ussd', '')}.png`;

  useEffect(() => {
    const img = new Image();
    img.src = logoUrl;
    img.onload = () => setHasImage(true);
  }, [logoUrl]);

  return (
    <div className={cn(
      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 overflow-hidden",
      selected ? "bg-white/10" : bg,
      isCustomImg || hasImage ? "p-0" : ""
    )}>
      {hasImage ? (
        <img src={logoUrl} alt={id} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <Icon className={cn(
          isCustomImg ? "w-full h-full rounded-xl" : "w-6 h-6", 
          selected ? "text-white" : color
        )} />
      )}
    </div>
  );
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (method: string, transactionId?: string, isVerified?: boolean) => void;
  amount: number;
  title?: string;
  description?: string;
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  amount,
  title = "Paiement Sécurisé",
  description = "Le montant est bloqué par notre plateforme et ne sera versé au livreur qu'une fois la confirmation de livraison effectuée par vos soins."
}: PaymentModalProps) {
  const { appConfig } = useAuth();
  const [step, setStep] = useState(1); // 1: Methods, 2: USSD/Input, 3: Success/Waiting
  const [selectedMethod, setSelectedMethod] = useState<'orange' | 'moov' | 'telecel' | 'coris' | 'orange_ussd' | 'moov_ussd' | 'telecel_ussd' | 'card' | 'cash' | 'aggregator' | 'ussd' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [waitingForAdmin, setWaitingForAdmin] = useState(false);
  const [sappayInvoiceId, setSappayInvoiceId] = useState('');
  const [sappayAccessToken, setSappayAccessToken] = useState('');
  const [sappayTransId, setSappayTransId] = useState('');
  const [sappayStep, setSappayStep] = useState<'init' | 'otp' | 'pending'>('init');
  const [error, setError] = useState<string | null>(null);

  const isDemo = false;

  const getUssdString = () => {
    let syntax = "";
    if (selectedMethod === 'orange' || selectedMethod === 'orange_ussd') {
      syntax = appConfig?.ussdSyntaxOrange || "*144*4*6*{amount}#";
    } else if (selectedMethod === 'moov' || selectedMethod === 'moov_ussd') {
      syntax = appConfig?.ussdSyntaxMoov || "*155*4*1*{amount}#";
    } else if (selectedMethod === 'telecel' || selectedMethod === 'telecel_ussd') {
      syntax = appConfig?.ussdSyntaxTelecel || "*808*4*4*{amount}#";
    } else if (selectedMethod === 'coris') {
      syntax = appConfig?.ussdSyntaxCoris || "*555*1*1*{amount}#";
    } else {
      syntax = appConfig?.ussdSyntaxGeneric || "*144*4*6*{amount}#";
    }
    
    // Replace the {amount} variable with the actual amount (case insensitive, and allow {montant})
    return syntax
      .replace(/\{amount\}/ig, amount.toString())
      .replace(/\{montant\}/ig, amount.toString());
  };

  const processors: Record<string, string> = {
    orange: '11688813752134336',
    telecel: '11744695746597207',
    moov: '11688813838374580',
    coris: '11702302492453862'
  };

  const handleInitialConfirm = async () => {
    setError(null);
    const methodObj = methods.find(m => m.id === selectedMethod);

    if (methodObj?.type === 'otp') {
      setStep(2);
      setSappayStep('init');
    } else if (methodObj) {
      if (methodObj.type === 'ussd') {
         // Sur mobile (Capacitor), window.location.href peut fermer la webview, on utilise window.open avec _system
         window.open(`tel:${getUssdString().replace('#', '%23')}`, '_system');
      }
      setStep(2);
    }
  };

  const getApiUrl = (path: string) => {
    let apiBase = "/api";
    if (typeof window !== 'undefined') {
      const cachedUrl = localStorage.getItem('custom_api_base');
      if (cachedUrl) {
        apiBase = cachedUrl;
      } else {
        // @ts-ignore
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
          apiBase = "http://41.78.54.60:3006/api";
        }
      }
    }
    
    if (path.startsWith('/api')) {
      if (apiBase.startsWith('http')) {
        return path.replace('/api', apiBase);
      }
    }
    return path;
  };

  const cleanPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('00226')) {
      cleaned = cleaned.slice(5);
    } else if (cleaned.startsWith('226')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.length > 8) {
      cleaned = cleaned.slice(-8);
    }
    return cleaned;
  };

  const extractSpecificError = (errorData: any, defaultMsg: string): string => {
    if (!errorData) return defaultMsg;

    // Check if errorData or specific attributes contain HTML
    const isHtml = (str: any) => typeof str === 'string' && (str.trim().startsWith('<') || str.includes('<html') || str.includes('<h1>Oops') || str.includes('Ooops!!! 500'));
    
    if (isHtml(errorData)) {
      return "Le serveur de paiement Sappay rencontre des perturbations temporaires (Erreur interne 500). Veuillez réessayer dans quelques instants.";
    }

    if (errorData.details) {
      if (isHtml(errorData.details)) {
        return "Le serveur de paiement de l'opérateur (Sappay) rencontre actuellement des perturbations temporaires (Erreur interne 500). Veuillez réessayer dans quelques instants.";
      }
      if (typeof errorData.details === 'string') {
        try {
          const parsedDetails = JSON.parse(errorData.details);
          return extractSpecificError(parsedDetails, errorData.details);
        } catch (e) {
          if (errorData.details.trim().startsWith('{') || errorData.details.trim().startsWith('[')) {
            // Keep going
          } else {
            return errorData.details;
          }
        }
      } else if (typeof errorData.details === 'object') {
        return extractSpecificError(errorData.details, defaultMsg);
      }
    }

    if (errorData.response?.gateway_message) {
      if (isHtml(errorData.response.gateway_message)) return "Erreur serveur partenaire (500)";
      return errorData.response.gateway_message;
    }
    if (errorData.gateway_message) {
      if (isHtml(errorData.gateway_message)) return "Erreur serveur partenaire (500)";
      return errorData.gateway_message;
    }
    if (errorData.message) {
      if (isHtml(errorData.message)) return "Le serveur de l'opérateur rencontre des perturbations (500).";
      return errorData.message;
    }
    if (errorData.error_description) {
      if (isHtml(errorData.error_description)) return "Erreur de communication opérateur (500)";
      return errorData.error_description;
    }
    if (errorData.error && typeof errorData.error === 'string') {
      if (isHtml(errorData.error)) {
        return "Le serveur Sappay rencontre des perturbations (Erreur interne 500). Veuillez réessayer dans quelques instants.";
      }
      if (errorData.error !== "Sappay OTP Error" && errorData.error !== "Sappay Perform Error") {
        return errorData.error;
      }
    }
    
    return defaultMsg;
  };

  const handleSappayInit = async () => {
    setError(null);
    if (!phoneNumber) {
      setError("Veuillez entrer votre numéro de téléphone");
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. Authentification & Facture (via Proxy)
      const initRes = await fetch(getApiUrl('/api/payment/sappay/init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          note: `COURSE PANCHO #${Math.random().toString(36).substr(2, 5)}`,
          email: 'client@pancho.app'
        })
      });
      
      if (!initRes.ok) {
        let errorMsg = "Erreur de connexion à Sappay.";
        try {
          const textBody = await initRes.text();
          try {
            const errorData = JSON.parse(textBody);
            errorMsg = extractSpecificError(errorData, errorMsg);
          } catch (e) {
            // Pas du JSON, probablement du HTML ou texte brut
            if (initRes.status === 404) errorMsg = "Service de paiement indisponible (404).";
            else if (initRes.status === 500) errorMsg = `Erreur serveur (${initRes.status}).`;
            else errorMsg = `Erreur ${initRes.status}: ${textBody.substring(0, 100)}`;
          }
        } catch (e) {
          errorMsg = "Impossible d'initialiser la facture. Vérifiez vos identifiants Sappay.";
        }
        throw new Error(errorMsg);
      }

      let initData;
      try {
        const textData = await initRes.text();
        initData = JSON.parse(textData);
      } catch (e) {
        throw new Error("Réponse invalide du serveur (JSON attendu).");
      }
      setSappayInvoiceId(initData.invoice_id);
      setSappayAccessToken(initData.access_token);

      // 2. Déclenchement OTP : obligatoire pour Moov Money et Coris Money, mais pas pour Orange ou Telecel
      const isMoovOrCoris = selectedMethod === 'moov' || selectedMethod === 'coris';
      if (isMoovOrCoris) {
        const otpRes = await fetch(getApiUrl('/api/payment/sappay/get-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_msisdn: cleanPhoneNumber(phoneNumber),
            invoice_id: initData.invoice_id,
            payment_processor_id: processors[selectedMethod as string],
            access_token: initData.access_token
          })
        });
        
        if (!otpRes.ok) {
            let errorMsg = "Erreur lors de l'envoi de la requête OTP.";
            try {
              const textBody = await otpRes.text();
              try {
                const otpError = JSON.parse(textBody);
                errorMsg = extractSpecificError(otpError, errorMsg);
              } catch (e) {
                errorMsg = `Erreur OTP ${otpRes.status}`;
              }
            } catch (e) {
              errorMsg = "Le réseau n'a pas pu envoyer la requête OTP. Réessayez.";
            }
            throw new Error(errorMsg);
        }

        let otpData;
        try {
          const textOtp = await otpRes.text();
          otpData = JSON.parse(textOtp);
        } catch (e) {
          throw new Error("Format de réponse OTP invalide.");
        }
        if (otpData.trans_id) setSappayTransId(otpData.trans_id);
      } else {
        setSappayTransId('');
      }

      setSappayStep('otp');
    } catch (err: any) {
      // Log as warning to avoid looking like a code crash
      console.warn("Init warning:", err.message);
      setError(err.message || "Une erreur technique est survenue.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async () => {
    setError(null);
    const methodObj = methods.find(m => m.id === selectedMethod);
    
    if (methodObj?.type === 'otp') {
      if (sappayStep === 'init') {
        await handleSappayInit();
        return;
      }

      if (!otpCode) {
        setError("Veuillez entrer le code OTP reçu");
        return;
      }

      setIsProcessing(true);
      try {
        const performRes = await fetch(getApiUrl('/api/payment/sappay/perform'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: sappayInvoiceId,
            payment_processor_id: processors[selectedMethod as string],
            customer_msisdn: cleanPhoneNumber(phoneNumber),
            otp: otpCode,
            access_token: sappayAccessToken,
            trans_id: sappayTransId
          })
        });

        if (!performRes.ok) {
           let errorMsg = "Transaction refusée par l'opérateur.";
           try {
             const textBody = await performRes.text();
             try {
               const errorData = JSON.parse(textBody);
               errorMsg = extractSpecificError(errorData, errorMsg);
             } catch (e) {
               errorMsg = `Erreur validation ${performRes.status}`;
             }
           } catch (e) {
             errorMsg = "Erreur réseau lors de la validation. Vérifiez votre solde.";
           }
           throw new Error(errorMsg);
        }

        let performData;
        try {
          const textPerform = await performRes.text();
          performData = JSON.parse(textPerform);
        } catch (e) {
          throw new Error("Format de réponse de validation invalide.");
        }
        
        // On considère SUCCESS comme validé sans admin, PENDING avec admin
        const isSuccess = 
          performData.success === true ||
          performData.status === 'SUCCESS' ||
          performData.status === 200 ||
          performData.response?.status === 'SUCCESS' ||
          performData.invoice_details?.status === 'SUCCESS' ||
          performData.invoice_detail?.status === 'SUCCESS' ||
          performData.response?.invoice_detail?.status === 'SUCCESS';

        const isPending = 
          performData.status === 'PENDING' ||
          performData.response?.status === 'PENDING' ||
          performData.invoice_details?.status === 'PENDING' ||
          performData.invoice_detail?.status === 'PENDING' ||
          performData.response?.invoice_detail?.status === 'PENDING';

        if (isSuccess || isPending) {
          onConfirm(selectedMethod as any, sappayInvoiceId, isSuccess);
          if (isSuccess) {
            onClose();
          } else {
            // PENDING : On attend la validation finale (admin ou webhook)
            setSappayStep('pending');
            setWaitingForAdmin(true);
            setStep(3);
          }
        } else {
          let detailMsg = performData.message || performData.error_description || performData.error || performData.details?.message;
          if (detailMsg === "Transaction Failed") {
            detailMsg = "Échec de la transaction (Fonds insuffisants ou code invalide).";
          }
          throw new Error(detailMsg || "Le paiement a échoué. Veuillez réessayer.");
        }
      } catch (err: any) {
        // Log as warning since it's typically a balance/code issue, not a technical bug
        console.warn("Transaction warning:", err.message);
        
        // Si l'erreur est "OTP does not exist", on propose de le renouveler
        if (err.message?.toLowerCase().includes("otp does not exist")) {
          setError("Session OTP expirée ou inexistante. Renouvellement automatique...");
          setTimeout(() => {
            handleSappayInit();
          }, 2000);
        } else {
          setError(err.message);
        }
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const isManual = methodObj?.type === 'ussd' || !isDemo;

    // Simplification USSD demandée par l'utilisateur
    if (methodObj?.type === 'ussd') {
      // Pas de check de transactionId
    } else if (isManual && !transactionId) {
       setError("Veuillez saisir l'ID de transaction reçu par SMS pour validation.");
       return;
    }

    setIsProcessing(true);
    try {
      // Simulation de délai pour le mode démo ou USSD
      await new Promise(r => setTimeout(r, 1500));
      
      setIsProcessing(false);
      
      const needsApproval = isManual || methodObj?.type === 'ussd';

      if (needsApproval) {
        setWaitingForAdmin(true);
        setStep(3);
        
        if (selectedMethod) {
          // Si USSD on utilise le accountName ou PAYÉ
          let finalId = transactionId || `REF-${Math.random().toString(36).substr(2, 5)}`;
          if (methodObj?.type === 'ussd') {
            finalId = accountName ? `PAYÉ (${accountName})` : "PAYÉ (USSD)";
          }
          onConfirm(selectedMethod as any, finalId, false);
        }
      } else {
        if (selectedMethod) {
          onConfirm(selectedMethod as any, transactionId, true);
          onClose();
        }
      }
    } catch (e: any) {
      setError(e.message || "Erreur lors du paiement");
      setIsProcessing(false);
    }
  };

  const rawMethods = [
    // OTP Group
    { id: 'orange', name: 'Orange Money', type: 'otp', icon: OrangeMoneyIcon, color: 'text-orange-600', bg: 'bg-white', border: 'border-orange-100', isCustomImg: true },
    { id: 'moov', name: 'Moov Money', type: 'otp', icon: MoovMoneyIcon, color: 'text-blue-600', bg: 'bg-white', border: 'border-blue-100', isCustomImg: true },
    { id: 'telecel', name: 'Telecel Cash', type: 'otp', icon: TelecelMoneyIcon, color: 'text-red-600', bg: 'bg-white', border: 'border-red-100', isCustomImg: true },
    { id: 'coris', name: 'Coris Money', type: 'otp', icon: CorisMoneyIcon, color: 'text-blue-600', bg: 'bg-white', border: 'border-blue-100', isCustomImg: true },
    
    // USSD Group
    { id: 'orange_ussd', name: 'Orange (USSD)', type: 'ussd', icon: Smartphone, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { id: 'moov_ussd', name: 'Moov (USSD)', type: 'ussd', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { id: 'telecel_ussd', name: 'Telecel (USSD)', type: 'ussd', icon: Smartphone, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    
    // Other Group
    { id: 'cash', name: 'Paiement Cash', type: 'cash', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { id: 'card', name: 'Carte Bancaire', type: 'card', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  ];

  const methods = rawMethods.filter(m => {
    // Group level deactivation
    if (m.type === 'otp' && appConfig?.isOtpActive === false) return false;
    if (m.type === 'ussd' && appConfig?.isUssdActive === false) return false;
    if (m.type === 'cash' && appConfig?.isCashActive !== true) return false;
    if (m.type === 'card' && appConfig?.isCardActive !== true) return false;
    
    // Provider level deactivation (Individual)
    if (m.id.startsWith('orange') && appConfig?.isOrangeActive === false) return false;
    if (m.id.startsWith('moov') && appConfig?.isMoovActive === false) return false;
    if (m.id.startsWith('telecel') && appConfig?.isTelecelActive === false) return false;
    if (m.id.startsWith('coris') && appConfig?.isCorisActive === false) return false;
    
    return true;
  });

  const getHeaderName = () => {
    const method = methods.find(m => m.id === selectedMethod);
    if (!method) return "MÉTHODE DE PAIEMENT";
    return method.name.toUpperCase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col h-auto max-h-[90vh] z-10"
          >
            {/* Header / Actions - Top Buttons */}
            <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center">
              {step > 1 ? (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="w-10 h-10 bg-slate-100/50 backdrop-blur border border-white/50 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : <div />}
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-slate-100/50 backdrop-blur border border-white/50 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto px-8 pt-10 pb-8 custom-scrollbar">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                  >
                    {/* Amount Display Block */}
                    <div className="bg-slate-50 border border-white rounded-[32px] p-10 text-center shadow-inner relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 leading-none italic">MONTANT DE LA COURSE</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-6xl font-black text-slate-950 tracking-tighter italic">{amount.toLocaleString('fr-FR')}</span>
                        <span className="text-xl font-black text-blue-900/40 italic mt-4 uppercase">FCFA</span>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Groupe OTP */}
                      {methods.filter(m => m.type === 'otp').length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 italic flex items-center gap-2">
                            <Smartphone className="w-3 h-3" /> Mobile Money (Direct OTP) :
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {methods.filter(m => m.type === 'otp').map((method) => (
                              <button
                                key={method.id}
                                onClick={() => setSelectedMethod(method.id as any)}
                                className={cn(
                                  "p-4 rounded-[28px] border-2 flex items-center gap-3 transition-all relative group h-20",
                                  selectedMethod === method.id 
                                    ? "bg-slate-950 border-slate-950 shadow-xl shadow-slate-950/20" 
                                    : "border-slate-50 bg-white hover:border-slate-100 shadow-sm"
                                )}
                              >
                                <PaymentIcon 
                                  id={method.id}
                                  icon={method.icon}
                                  isCustomImg={method.isCustomImg}
                                  bg={method.bg}
                                  color={method.color}
                                  selected={selectedMethod === method.id}
                                />
                                <div className="text-left flex-1 min-w-0">
                                  <p className={cn(
                                    "text-[10px] font-black tracking-tight uppercase italic truncate",
                                    selectedMethod === method.id ? "text-white" : "text-slate-900"
                                  )}>{method.name}</p>
                                </div>
                                {selectedMethod === method.id && (
                                  <div className="absolute bottom-3 right-3">
                                    <CheckCircle className="w-4 h-4 text-orange-500" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Groupe USSD */}
                      {methods.filter(m => m.type === 'ussd').length > 0 && (
                        <div className="space-y-3 pb-6">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 italic flex items-center gap-2">
                            <Clock className="w-3 h-3" /> Mobile Money (Syntaxe USSD) :
                          </p>
                          <div className="grid grid-cols-1 gap-3">
                            {methods.filter(m => m.type === 'ussd').map((method) => (
                              <button
                                key={method.id}
                                onClick={() => setSelectedMethod(method.id as any)}
                                className={cn(
                                  "p-5 rounded-[28px] border-2 flex items-center gap-4 transition-all relative group",
                                  selectedMethod === method.id 
                                    ? "bg-slate-950 border-slate-950 shadow-xl shadow-slate-950/20" 
                                    : "border-slate-50 bg-white hover:border-slate-100 shadow-sm"
                                )}
                              >
                                <PaymentIcon 
                                  id={method.id}
                                  icon={method.icon}
                                  bg={method.bg}
                                  color={method.color}
                                  selected={selectedMethod === method.id}
                                />
                                <div className="text-left flex-1 min-w-0">
                                  <p className={cn(
                                    "text-[10px] font-black tracking-tight uppercase italic truncate",
                                    selectedMethod === method.id ? "text-white" : "text-slate-900"
                                  )}>{method.name}</p>
                                  <p className={cn(
                                    "text-[9px] font-bold uppercase tracking-widest leading-none mt-1",
                                    selectedMethod === method.id ? "text-slate-400" : "text-slate-400"
                                  )}>Génération manuelle de code</p>
                                </div>
                                {selectedMethod === method.id && (
                                  <div className="absolute right-6">
                                    <CheckCircle className="w-5 h-5 text-orange-500" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Groupe Autre (Cash, Card) */}
                      {methods.filter(m => m.type === 'cash' || m.type === 'card').length > 0 && (
                        <div className="space-y-3 pb-6">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 italic flex items-center gap-2">
                             <ShieldCheck className="w-3 h-3" /> Autres Moyens :
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            {methods.filter(m => m.type === 'cash' || m.type === 'card').map((method) => (
                              <button
                                key={method.id}
                                onClick={() => setSelectedMethod(method.id as any)}
                                className={cn(
                                  "p-4 rounded-[28px] border-2 flex items-center gap-3 transition-all relative group h-20",
                                  selectedMethod === method.id 
                                    ? "bg-slate-950 border-slate-950 shadow-xl shadow-slate-950/20" 
                                    : "border-slate-50 bg-white hover:border-slate-100 shadow-sm"
                                )}
                              >
                                <PaymentIcon 
                                  id={method.id}
                                  icon={method.icon}
                                  bg={method.bg}
                                  color={method.color}
                                  selected={selectedMethod === method.id}
                                />
                                <div className="text-left flex-1 min-w-0">
                                  <p className={cn(
                                    "text-[10px] font-black tracking-tight uppercase italic truncate",
                                    selectedMethod === method.id ? "text-white" : "text-slate-900"
                                  )}>{method.name}</p>
                                </div>
                                {selectedMethod === method.id && (
                                  <div className="absolute bottom-3 right-3">
                                    <CheckCircle className="w-4 h-4 text-orange-500" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : step === 2 ? (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="bg-slate-50 border border-slate-100 rounded-[32px] p-8 text-center relative overflow-hidden">
                      <div className={cn(
                        "w-20 h-20 rounded-[28px] overflow-hidden flex items-center justify-center mx-auto mb-6 shadow-lg bg-white",
                        methods.find(m => m.id === selectedMethod)?.bg
                      )}>
                        <PaymentIcon 
                          id={selectedMethod as string}
                          icon={methods.find(m => m.id === selectedMethod)?.icon || Smartphone}
                          isCustomImg={methods.find(m => m.id === selectedMethod)?.isCustomImg}
                          bg={methods.find(m => m.id === selectedMethod)?.bg}
                          color={methods.find(m => m.id === selectedMethod)?.color}
                          selected={false}
                        />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight italic uppercase">
                        {selectedMethod === 'ussd' ? "Syntaxe Marchand" : selectedMethod === 'aggregator' ? "Portail PANCHO Pay" : `Validation ${methods.find(m => m.id === selectedMethod)?.name}`}
                      </h3>
                      
                      {methods.find(m => m.id === selectedMethod)?.type === 'ussd' || selectedMethod === 'orange' || selectedMethod === 'moov' || selectedMethod === 'telecel' || selectedMethod === 'coris' ? (
                        <div className="bg-white border-2 border-orange-100 rounded-2xl p-6 mt-4 shadow-inner">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Composez sur votre mobile :</p>
                          <div className="flex flex-col items-center gap-4">
                            <p className="text-xl font-black text-indigo-900 tracking-widest select-all">
                              {getUssdString()}
                            </p>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => window.open(`tel:${getUssdString().replace('#', '%23')}`, '_system')}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-orange-500 transition-colors"
                              >
                                <Smartphone className="w-4 h-4" /> Lancer l'appel
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(getUssdString());
                                  alert("Syntaxe copiée !");
                                }}
                                className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200 transition-colors"
                              >
                                <Copy className="w-4 h-4" /> Copier
                              </button>
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-4 font-bold uppercase tracking-widest text-center">
                            {selectedMethod?.includes('orange') ? "Syntaxe Orange Money" : selectedMethod?.includes('moov') ? "Syntaxe Moov Money" : selectedMethod?.includes('telecel') ? "Syntaxe Telecel Cash" : "Syntaxe Marchand"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 leading-relaxed max-w-xs mx-auto">
                          Entrez le numéro payeur pour l'envoi de la requête de paiement.
                        </p>
                      )}
                    </div>

                    <div className="space-y-6">
                      {/* CHAMP NOM DU COMPTE OU ID TRANSACTION */}
                      {methods.find(m => m.id === selectedMethod)?.type === 'ussd' ? (
                        <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 pl-2 block italic">
                            Nom du compte (Facultatif)
                          </label>
                          <input 
                            type="text" 
                            placeholder="Ex: Jean Dupont" 
                            value={accountName}
                            onChange={e => setAccountName(e.target.value)}
                            className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-black text-xl text-slate-900 focus:outline-none focus:border-orange-500 transition-all outline-none"
                          />
                          <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-2 pl-2">
                            Nom utilisé pour effectuer le paiement.
                          </p>
                        </div>
                      ) : (
                        methods.find(m => m.id === selectedMethod)?.type !== 'otp' && !isDemo && (
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 pl-2 block italic">
                              ID de Transaction / Référence SMS
                            </label>
                            <input 
                              type="text" 
                              placeholder="Entrez l'identifiant reçu par SMS" 
                              value={transactionId}
                              onChange={e => setTransactionId(e.target.value)}
                              className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-black text-xl text-slate-900 focus:outline-none focus:border-orange-500 transition-all outline-none"
                            />
                            <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-2 pl-2">
                              Vérifiez le SMS de confirmation de votre opérateur.
                            </p>
                          </div>
                        )
                      )}

                      {/* ÉCRAN INITIAL : SAISIE NUMÉRO OU GÉNÉRATION SMS */}
                      {methods.find(m => m.id === selectedMethod)?.type === 'otp' && sappayStep === 'init' && (
                        <div className="space-y-6">
                           <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4">
                            <Smartphone className="w-6 h-6 text-blue-500 shrink-0" />
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest leading-none">Étape 1 : Initialisation</p>
                              <p className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest leading-relaxed">
                                {selectedMethod === 'moov' || selectedMethod === 'coris' 
                                  ? "Générez un code de validation qui vous sera envoyé par SMS par votre opérateur." 
                                  : "Vérifiez votre numéro pour passer à l'étape suivante (Génération du code OTP via USSD)."}
                              </p>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 pl-2 block italic">Votre numéro de téléphone</label>
                            <input 
                              type="tel" 
                              placeholder="Ex: 70000000" 
                              value={phoneNumber}
                              onChange={e => setPhoneNumber(e.target.value)}
                              className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-black text-xl text-slate-900 focus:outline-none focus:border-orange-500 transition-all outline-none"
                            />
                            <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-2 pl-2">Format: 8 chiffres (Ex: 65800508)</p>
                          </div>
                        </div>
                      )}

                      {/* ÉCRAN OTP SAPPAY : SAISIE CODE VERSION DYNAMIQUE */}
                      {methods.find(m => m.id === selectedMethod)?.type === 'otp' && sappayStep === 'otp' && (
                        <div className="space-y-6">
                          <div className={cn(
                            "rounded-2xl p-5 flex items-start gap-4 shadow-sm",
                            selectedMethod === 'moov' || selectedMethod === 'coris' ? "bg-emerald-50 border border-emerald-100" : "bg-orange-50 border border-orange-100"
                          )}>
                            {selectedMethod === 'moov' || selectedMethod === 'coris' ? <Smartphone className="w-6 h-6 text-emerald-500 shrink-0" /> : <Clock className="w-6 h-6 text-orange-500 shrink-0" />}
                            <div className="space-y-1">
                              <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest leading-none",
                                selectedMethod === 'moov' || selectedMethod === 'coris' ? "text-emerald-700" : "text-orange-700"
                              )}>
                                {selectedMethod === 'orange' ? "Orange Money (Burkina)" : 
                                 selectedMethod === 'telecel' ? "Telecel Cash (Burkina)" :
                                 selectedMethod === 'moov' ? "Moov Money (Burkina)" : "Coris Money"} : Étape 2
                              </p>
                              <p className={cn(
                                "text-[10px] font-bold uppercase tracking-widest leading-relaxed",
                                selectedMethod === 'moov' || selectedMethod === 'coris' ? "text-emerald-600/80" : "text-orange-600/80"
                              )}>
                                {selectedMethod === 'orange' ? `Composez *144*4*6*${amount}# sur votre téléphone pour recevoir votre CODE SECRET OTP.` : 
                                 selectedMethod === 'telecel' ? `Composez *808*4*4*${amount}# sur votre téléphone pour recevoir votre CODE OTP.` : 
                                 selectedMethod === 'moov' ? "Saisissez le code de validation reçu par SMS et l'ID de transaction." :
                                 "Saisissez le code de validation à 5 chiffres reçu par SMS."}
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div>
                              <div className="flex justify-between items-end mb-3 pl-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block italic leading-none">Code de Validation OTP</label>
                                {selectedMethod === 'orange' || selectedMethod === 'telecel' ? (
                                  <button 
                                    onClick={() => window.open(`tel:${getUssdString().replace('#', '%23')}`, '_system')}
                                    className="text-[9px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1 hover:underline"
                                  >
                                    <Smartphone className="w-3 h-3" /> Relancer la syntaxe
                                  </button>
                                ) : null}
                              </div>
                              <input 
                                type="text" 
                                placeholder={selectedMethod === 'coris' ? "00000" : "000000"} 
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value)}
                                className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-black text-3xl text-center text-slate-900 tracking-[0.25em] focus:outline-none focus:border-orange-500 transition-all outline-none"
                              />
                            </div>

                            {selectedMethod === 'moov' && (
                              <div className="pt-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 pl-2 block italic">Référence de Transaction SMS (ID)</label>
                                <input 
                                  type="text" 
                                  placeholder="Ex: OMROR24..." 
                                  value={sappayTransId}
                                  onChange={e => setSappayTransId(e.target.value)}
                                  className="w-full px-8 py-4 bg-slate-50 border-2 border-slate-100 rounded-[28px] font-extrabold text-center text-slate-600 focus:outline-none focus:border-orange-500 transition-all outline-none"
                                />
                                <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-2 pl-2 text-center italic">Cet identifiant se trouve dans le SMS récapitulatif de Moov.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-4">
                        <ShieldCheck className="w-6 h-6 text-emerald-500 shrink-0" />
                            <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest leading-relaxed">
                          Transaction Sécurisée. Vos fonds sont protégés par le protocole de séquestre PANCHO.
                        </p>
                      </div>

                      {error && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 flex items-start gap-4"
                        >
                          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                          <div>
                            <p className="text-[10px] font-black uppercase text-red-800 tracking-widest leading-none mb-1">Attention</p>
                            <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide leading-relaxed">
                              {error}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="py-8 text-center space-y-8"
                  >
                    <div className="w-32 h-32 bg-slate-950 text-white rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-2xl relative">
                      <Clock className="w-16 h-16 animate-pulse" />
                      <div className="absolute -bottom-2 -right-2 bg-orange-500 w-8 h-8 rounded-full flex items-center justify-center border-4 border-white">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic uppercase leading-none">Vérification Admin...</h3>
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed max-w-xs mx-auto uppercase tracking-widest italic">
                        L'administration vérifie la réception de votre paiement avant de valider la course.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer - Fixed Button */}
            <div className="p-8 bg-slate-50/50 border-t border-slate-100 shrink-0">
              {step === 1 ? (
                <button
                  disabled={!selectedMethod}
                  onClick={handleInitialConfirm}
                  className="w-full py-5 bg-slate-950 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] shadow-2xl shadow-slate-950/20 hover:bg-orange-500 active:scale-95 transition-all disabled:opacity-30 italic"
                >
                  Continuer
                </button>
              ) : step === 2 ? (
                <div className="space-y-4">
                  <button
                    disabled={isProcessing || (methods.find(m => m.id === selectedMethod)?.type === 'otp' && phoneNumber.length < 8)}
                    onClick={handlePayment}
                    className="w-full py-5 bg-orange-500 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] shadow-2xl shadow-orange-500/30 hover:bg-slate-950 active:scale-95 transition-all flex items-center justify-center gap-4 italic disabled:opacity-30"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      methods.find(m => m.id === selectedMethod)?.type === 'ussd' ? "J'AI EFFECTUÉ LE PAIEMENT" : 
                      (methods.find(m => m.id === selectedMethod)?.type === 'otp' && sappayStep === 'init') ? 
                        (selectedMethod === 'orange' || selectedMethod === 'telecel' ? "INITIER LE PAIEMENT" : "GÉNÉRER LE CODE") :
                      (methods.find(m => m.id === selectedMethod)?.type === 'otp' && sappayStep === 'otp') ? "VALIDER LE PAIEMENT" :
                      "Vérifier la Transaction"
                    )}
                  </button>
                  <button onClick={() => setStep(1)} className="w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Modifier le mode</button>
                </div>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-5 bg-slate-950 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[24px] italic"
                >
                  TERMINE LA CONSULTATION
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
