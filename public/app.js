const LANGUAGE_KEY = "postpilot_language";
const sessionId = "session-main";
let accountState = null;

const authGate = document.getElementById("authGate");
const chatApp = document.getElementById("chatApp");
const signupForm = document.getElementById("signupForm");
const signinForm = document.getElementById("signinForm");
const signupFeedback = document.getElementById("signupFeedback");
const signinFeedback = document.getElementById("signinFeedback");
const signinModal = document.getElementById("signinModal");
const openSignin = document.getElementById("openSignin");
const openTrialBtn = document.getElementById("openTrialBtn");
const closeSignin = document.getElementById("closeSignin");
const closeOnboarding = document.getElementById("closeOnboarding");
const disconnectBtn = document.getElementById("disconnectBtn");
const resetChatBtn = document.getElementById("resetChatBtn");
const agentViewBtn = document.getElementById("agentViewBtn");
const analyticsViewBtn = document.getElementById("analyticsViewBtn");
const agentView = document.getElementById("agentView");
const analyticsView = document.getElementById("analyticsView");
const manageBillingBtn = document.getElementById("manageBillingBtn");
const cancelSubscriptionBtn = document.getElementById("cancelSubscriptionBtn");
const connectLinkedinBtn = document.getElementById("connectLinkedinBtn");
const connectInstagramBtn = document.getElementById("connectInstagramBtn");
const languageSelect = document.getElementById("languageSelect");
const googleSignupBtn = document.getElementById("googleSignupBtn");
const googleSigninBtn = document.getElementById("googleSigninBtn");
const authToast = document.getElementById("authToast");
const onboardingModal = document.getElementById("onboardingModal");
let onboardingHideTimer = null;
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || "en";

const I18N = {
  en: {
    language: "Language",
    heroBadge: "Founding Access - Intro Offer",
    heroTitleMain: "Build Your Audience Faster.",
    heroTitleAccent: "With an AI Coach in Your Corner.",
    heroSubtitle: "Receive one tailored content direction each day and the confidence to publish it.",
    signal1: "Tailored prompts every day",
    signal2: "Feedback matched to your tone",
    signal3: "Straight advice. No filler.",
    socialProofTitle: "Creators Trust PostPilot",
    socialProofSubtitle: "Thousands are creating with more clarity and confidence",
    testimonial1Quote: "\"It reviewed my Instagram and explained exactly what my audience responds to.\"",
    testimonial1Role: "Freedom & Purpose Coach",
    testimonial2Quote: "\"It brought back confidence in my voice - I finally knew what to post.\"",
    testimonial2Role: "Life & Fitness Glow-Up Coach",
    testimonial3Quote: "\"It was honest and specific - no fake hype. Exactly what I needed.\"",
    testimonial3Role: "Health & Wellness Coach",
    achieveTitle: "What Changes for You",
    achieveSubtitle: "PostPilot does more than suggest ideas - it upgrades your full creation process.",
    feature1Title: "Grow your audience with momentum",
    feature1Text: "Consistent, high-impact content that speaks to the right people",
    feature2Title: "Create in a rhythm that fits you",
    feature2Text: "Turn repeatable wins into your recognizable creator style",
    feature3Title: "Post with confidence every day",
    feature3Text: "Stop second-guessing and start shipping with clarity",
    feature4Title: "Make publishing automatic",
    feature4Text: "Move from forced posting to a sustainable content habit",
    comingSoonBadge: "Up Next",
    comingSoonTitle: "More Powerful Features Are Coming",
    comingSoonSubtitle: "We are actively building the next layer of creator tools.",
    chip1: "Smart AI video assistant",
    chip2: "Performance insight hub",
    chip3: "Carousel draft builder",
    chip4: "Daily publishing planner",
    chip5: "Evergreen idea library",
    finalCtaTitle: "You do not need another noisy platform.",
    finalCtaSubtitle: "You need a coach that helps you act on your best ideas.",
    finalCtaClosing: "That is PostPilot.",
    finalCtaGuarantee: "Cancel anytime - protected by our full refund promise",
    finalLegalNote: "PostPilot Studio 2026 - Designed for independent creators.",
    signupTitle: "Start Your Free Trial",
    continueGoogle: "Continue with Google",
    or: "or",
    fullName: "Full name",
    emailAddress: "Email address",
    password: "Password",
    tipsOptIn: "Send me Creator tips and other opportunities",
    createAccount: "Create account",
    guarantee1: "30-day refund policy",
    guarantee2: "Cancel whenever you want - hassle free",
    alreadyAccount: "Already have an account?",
    signIn: "Sign in",
    agentView: "Agent",
    analyticsView: "Analytics",
    newChat: "Reset chat",
    settings: "Settings",
    disconnect: "Disconnect",
    chatSubtitle: "Your creator growth assistant",
    chatInputPlaceholder: "Message PostPilot Agent",
    suggestionsLabel: "Suggestions",
    suggestions: [
      { icon: "📊", label: "Analyze performance", prompt: "Analyze my latest performance and tell me what to improve" },
      { icon: "✏️", label: "Generate post draft", prompt: "Write a post draft based on my niche and recent best-performing content" },
      { icon: "📅", label: "Weekly content plan", prompt: "Create my weekly content plan with specific post ideas for each day" },
      { icon: "♻️", label: "Repurpose a post", prompt: "Take my best performing post and repurpose it into 3 different formats" },
      { icon: "💬", label: "Caption ideas", prompt: "Give me 5 engaging caption ideas based on my niche and audience" },
      { icon: "🚀", label: "Growth tips", prompt: "What are the top 3 things I should change to grow faster on social media?" },
    ],
    analyticsTotalPosts: "Total posts",
    analyticsTotalLikes: "Total likes",
    analyticsTotalComments: "Total comments",
    analyticsAvgEngagement: "Avg engagement / post",
    analyticsEngagementTrend: "Engagement over time",
    analyticsPerformanceByType: "Performance by content type",
    analyticsBestDay: "Best day to post",
    analyticsCaptionLength: "Caption length vs engagement",
    analyticsTopPosts: "Top posts by engagement",
    chartLikes: "Likes",
    chartComments: "Comments",
    chartPosts: "Posts",
    chartAvgEngagement: "Avg engagement",
    chartCaptionLengthAxis: "Caption length (chars)",
    chartEngagementAxis: "Engagement",
    chartAvgEngShort: "Avg eng.",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "You",
    send: "Send",
    saveSettings: "Save settings",
    onboardingRequired: "Complete onboarding when you are ready. I need those details before I can coach your content.",
    disconnectToast: "Disconnected. Sign in again when you are ready.",
    newChatStarted: "New chat started. Ask for drafts, analytics, repurposing, or a weekly plan.",
    onboardingDone: "Onboarding complete. I am ready to coach your content strategy.",
    settingsSaved: "Settings saved. I refreshed your account profile and content sources.",
    initialAssistant: "I am your AI content agent. Complete onboarding, then ask for drafts, analytics, weekly plans, or repurposing.",
    signInModalTitle: "Sign In to PostPilot",
    signInSubmit: "Sign in",
    signinPasswordPh: "Enter your password",
    signupPhFullName: "Enter your full name",
    signupPhEmail: "you@example.com",
    signupPhPassword: "Create a password",
    accountPhName: "Your name",
    accountPhEmail: "you@domain.com",
    onboardingCreateTitle: "Create your account",
    onboardingCreateSubtitle: "Set up your creator profile to unlock your AI agent.",
    onboardingFormTitle: "Complete onboarding",
    onboardingFormSubtitle:
      "Tell us about your niche and main objective. You can connect LinkedIn and Instagram later in Settings.",
    onboardPhNiche: "e.g. creator education for coaches",
    onboardPhObjective: "e.g. grow inbound leads from content",
    shortName: "Name",
    shortEmail: "Email",
    nicheLabel: "Niche",
    objectiveShort: "Objective",
    onboardObjectiveLabel: "Main objective",
    linkedinUsername: "LinkedIn username",
    instagramUsername: "Instagram username",
    completeOnboarding: "Complete onboarding",
    settingsModalHeading: "Settings",
    tabGeneral: "General",
    tabAccount: "Account",
    tabConnections: "Connections",
    panelGeneral: "General",
    panelAccount: "Account",
    panelConnections: "Connections",
    settingsNicheHint: "Your core content angle and audience.",
    settingsObjectiveHint: "Main growth outcome for this quarter.",
    onboardingKicker: "Get Started",
    paymentModeTitle: "Activate your plan",
    paymentModeSubtitle: "Complete your EUR 30/month subscription to unlock the AI coach.",
    onboardingExplainerTitle: "What PostPilot does",
    onboardingExplainerBody: "Analyzes your content, identifies growth patterns, and gives practical weekly actions, drafts, and feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Activate your subscription",
    paymentPriceSuffix: " / month",
    paymentFeature1: "Full AI coaching chat access",
    paymentFeature2: "Content strategy and draft generation",
    paymentFeature3: "Weekly planning and performance insights",
    paymentAgree: "I agree to start a monthly EUR 30 subscription.",
    paymentSubmit: "Complete payment",
    paymentRequiredBeforeContinuing: "Payment is required before continuing.",
    paymentCompleteToContinue: "Complete payment to continue.",
    paymentEndpointUnavailable: "Payment endpoint is unavailable. Restart the server and try again.",
    onboardingMissingFields: "Complete niche and objective to continue.",
    paymentConfirmTerms: "Please confirm the subscription terms.",
    paymentCheckoutSessionError: "Could not create Stripe checkout session.",
    checkoutCanceled: "Checkout was canceled. Complete payment to unlock the AI coach.",
    checkoutProcessing: "Payment processing complete. Verifying subscription...",
    googleConnected: "Connected with Google.",
    connectAccount: "Connect account",
    reconnectAccount: "Reconnect account",
    connectedViaOauth: "Connected via OAuth",
    notConnected: "Not connected",
    integrationRedirecting: "Redirecting to secure authorization...",
    integrationAuthUrlMissing: "Authorization URL missing.",
    integrationConnectFailedPrefix: "Could not start account connection",
    integrationConnectedToast: "{platform} connected successfully.",
    integrationConnectErrorToast: "Could not connect {platform}: {error}",
  },
  ro: {
    language: "Limba",
    heroBadge: "Acces Timpuriu - Oferta Limitata",
    heroTitleMain: "Creste-ti comunitatea.",
    heroTitleAccent: "Cu propriul tau coach AI.",
    heroSubtitle: "Primeste zilnic idei virale personalizate si increderea de a le publica.",
    signal1: "Prompturi personalizate zilnic",
    signal2: "Feedback adaptat vocii tale",
    signal3: "Fara fluff. Doar claritate.",
    socialProofTitle: "Creatorii iubesc PostPilot",
    socialProofSubtitle: "Alatura-te miilor care si-au gasit increderea creativa",
    testimonial1Quote: "\"Mi-a analizat Instagramul si mi-a spus exact ce vede audienta mea.\"",
    testimonial1Role: "Coach de libertate si scop",
    testimonial2Quote: "\"Mi-a redat increderea in vocea mea - de parca in sfarsit stiam ce sa spun.\"",
    testimonial2Role: "Coach de viata si fitness",
    testimonial3Quote: "\"Mi-a spus adevarul - fara vorbe goale, fara laude false. Exact ce aveam nevoie.\"",
    testimonial3Role: "Coach de sanatate si wellness",
    achieveTitle: "Ce vei obtine",
    achieveSubtitle: "PostPilot nu iti ofera doar idei. Iti transforma modul de a crea.",
    feature1Title: "Creste-ti audienta mai rapid",
    feature1Text: "Continut constant si de calitate, care rezoneaza cu urmaritorii tai ideali",
    feature2Title: "Gaseste-ti ritmul creativ",
    feature2Text: "Descopera ce functioneaza pentru tine si transforma in stilul tau semnatura",
    feature3Title: "Apari cu incredere, zi de zi",
    feature3Text: "Fara sa mai supraanalizezi sau sa te indoiesti de continutul tau",
    feature4Title: "Transforma postarea din corvoada in obicei",
    feature4Text: "Fa crearea continutului sa para naturala, nu fortata",
    comingSoonBadge: "In curand",
    comingSoonTitle: "Acesta este doar inceputul",
    comingSoonSubtitle: "Pregatim functii noi si interesante.",
    chip1: "Editor video cu AI",
    chip2: "Panou cu analize si indicatori",
    chip3: "Generator de carusele",
    chip4: "Programator zilnic de continut",
    chip5: "Banca de idei de continut",
    finalCtaTitle: "Nu ai nevoie de inca un tool de continut.",
    finalCtaSubtitle: "Ai nevoie de un coach care te ajuta sa crezi in ideile tale.",
    finalCtaClosing: "Acesta este PostPilot.",
    finalCtaGuarantee: "Anulezi oricand - garantie 100% banii inapoi",
    finalLegalNote: "PostPilot Labs 2026 - Construit pentru creatorii independenti.",
    signupTitle: "Incepe testul gratuit",
    continueGoogle: "Continua cu Google",
    or: "sau",
    fullName: "Nume complet",
    emailAddress: "Adresa de email",
    password: "Parola",
    tipsOptIn: "Trimite-mi sfaturi pentru creatori si alte oportunitati",
    createAccount: "Creeaza cont",
    guarantee1: "Garantie de returnare in 30 de zile",
    guarantee2: "Anulezi oricand - Fara intrebari",
    alreadyAccount: "Ai deja cont?",
    signIn: "Autentificare",
    agentView: "Agent",
    analyticsView: "Analize",
    newChat: "Reset chat",
    settings: "Setari",
    disconnect: "Deconectare",
    chatSubtitle: "Asistentul tau pentru crestere",
    chatInputPlaceholder: "Mesaj catre PostPilot Agent",
    suggestionsLabel: "Sugestii",
    suggestions: [
      { icon: "📊", label: "Analizeaza performanta", prompt: "Analizeaza-mi ultima performanta si spune-mi ce sa imbunatatesc" },
      { icon: "✏️", label: "Genereaza draft postare", prompt: "Scrie un draft de postare bazat pe nisa mea si continutul recent cu cele mai bune rezultate" },
      { icon: "📅", label: "Plan saptamanal de continut", prompt: "Creeaza-mi planul saptamanal de continut cu idei specifice de postari pentru fiecare zi" },
      { icon: "♻️", label: "Reutilizeaza o postare", prompt: "Ia cea mai performanta postare a mea si transform-o in 3 formate diferite" },
      { icon: "💬", label: "Idei de descrieri", prompt: "Da-mi 5 idei de descrieri captivante bazate pe nisa si audienta mea" },
      { icon: "🚀", label: "Sfaturi de crestere", prompt: "Care sunt cele mai importante 3 lucruri pe care ar trebui sa le schimb ca sa cresc mai repede pe social media?" },
    ],
    analyticsTotalPosts: "Total postari",
    analyticsTotalLikes: "Total aprecieri",
    analyticsTotalComments: "Total comentarii",
    analyticsAvgEngagement: "Interactiune medie / postare",
    analyticsEngagementTrend: "Interactiuni in timp",
    analyticsPerformanceByType: "Performanta dupa tip de continut",
    analyticsBestDay: "Cea mai buna zi de postare",
    analyticsCaptionLength: "Lungime descriere vs interactiuni",
    analyticsTopPosts: "Top postari dupa interactiuni",
    chartLikes: "Aprecieri",
    chartComments: "Comentarii",
    chartPosts: "Postari",
    chartAvgEngagement: "Interactiune medie",
    chartCaptionLengthAxis: "Lungime descriere (caractere)",
    chartEngagementAxis: "Interactiuni",
    chartAvgEngShort: "Int. medie",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Tu",
    send: "Trimite",
    saveSettings: "Salveaza setarile",
    onboardingRequired: "Completeaza onboarding-ul cand esti pregatit. Am nevoie de aceste detalii inainte sa te pot ajuta.",
    disconnectToast: "Deconectat. Autentifica-te din nou cand esti pregatit.",
    newChatStarted: "Chat nou pornit. Cere drafturi, analize, reutilizare sau un plan saptamanal.",
    onboardingDone: "Onboarding finalizat. Sunt gata sa te ajut cu strategia ta de continut.",
    settingsSaved: "Setarile au fost salvate. Am actualizat profilul si sursele tale de continut.",
    initialAssistant: "Sunt agentul tau AI de continut. Completeaza onboarding-ul, apoi cere drafturi, analize sau planuri saptamanale.",
    signInModalTitle: "Autentificare PostPilot",
    signInSubmit: "Intra in cont",
    signinPasswordPh: "Introdu parola",
    signupPhFullName: "Introdu numele complet",
    signupPhEmail: "exemplu@email.com",
    signupPhPassword: "Creeaza o parola",
    accountPhName: "Numele tau",
    accountPhEmail: "tu@domeniu.com",
    onboardingCreateTitle: "Creeaza contul",
    onboardingCreateSubtitle: "Configureaza profilul de creator ca sa activezi agentul AI.",
    onboardingFormTitle: "Finalizeaza onboarding-ul",
    onboardingFormSubtitle:
      "Spune-ne despre nisa si obiectivul principal. Poti conecta LinkedIn si Instagram mai tarziu din Setari.",
    onboardPhNiche: "ex: educatie pentru creatori si coachi",
    onboardPhObjective: "ex: crestere lead-uri din continut",
    shortName: "Nume",
    shortEmail: "Email",
    nicheLabel: "Nisa",
    objectiveShort: "Obiectiv",
    onboardObjectiveLabel: "Obiectiv principal",
    linkedinUsername: "Utilizator LinkedIn",
    instagramUsername: "Utilizator Instagram",
    completeOnboarding: "Finalizeaza onboarding-ul",
    settingsModalHeading: "Setari",
    tabGeneral: "General",
    tabAccount: "Cont",
    tabConnections: "Conexiuni",
    panelGeneral: "General",
    panelAccount: "Cont",
    panelConnections: "Conexiuni",
    settingsNicheHint: "Unghiul tau de continut si publicul tinta.",
    settingsObjectiveHint: "Rezultatul principal de crestere pentru acest trimestru.",
    onboardingKicker: "Incepe acum",
    paymentModeTitle: "Activeaza-ti planul",
    paymentModeSubtitle: "Finalizeaza abonamentul de 30 EUR/luna ca sa deblochezi coach-ul AI.",
    onboardingExplainerTitle: "Ce face PostPilot",
    onboardingExplainerBody: "Analizeaza continutul tau, identifica tipare de crestere si ofera actiuni practice saptamanale, drafturi si feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Activeaza abonamentul",
    paymentPriceSuffix: " / luna",
    paymentFeature1: "Acces complet la chat-ul AI de coaching",
    paymentFeature2: "Strategie de continut si generare de drafturi",
    paymentFeature3: "Planificare saptamanala si insight-uri de performanta",
    paymentAgree: "Sunt de acord sa pornesc un abonament lunar de 30 EUR.",
    paymentSubmit: "Finalizeaza plata",
    paymentRequiredBeforeContinuing: "Plata este necesara inainte de a continua.",
    paymentCompleteToContinue: "Finalizeaza plata pentru a continua.",
    paymentEndpointUnavailable: "Endpoint-ul de plata nu este disponibil. Reporneste serverul si incearca din nou.",
    onboardingMissingFields: "Completeaza nisa si obiectivul pentru a continua.",
    paymentConfirmTerms: "Te rog confirma termenii abonamentului.",
    paymentCheckoutSessionError: "Nu am putut crea sesiunea Stripe Checkout.",
    checkoutCanceled: "Checkout-ul a fost anulat. Finalizeaza plata pentru a debloca AI coach-ul.",
    checkoutProcessing: "Plata a fost trimisa. Verificam abonamentul...",
    googleConnected: "Conectat cu Google.",
    connectAccount: "Conecteaza contul",
    reconnectAccount: "Reconecteaza contul",
    connectedViaOauth: "Conectat prin OAuth",
    notConnected: "Neconectat",
    integrationRedirecting: "Redirectionare catre autorizarea securizata...",
    integrationAuthUrlMissing: "Lipseste URL-ul de autorizare.",
    integrationConnectFailedPrefix: "Nu am putut porni conectarea contului",
    integrationConnectedToast: "{platform} a fost conectat cu succes.",
    integrationConnectErrorToast: "Nu am putut conecta {platform}: {error}",
  },
  it: {
    language: "Lingua",
    heroBadge: "Accesso Anticipato - Offerta Limitata",
    heroTitleMain: "Fai crescere il tuo pubblico.",
    heroTitleAccent: "Con il tuo coach AI personale.",
    heroSubtitle: "Ricevi ogni giorno idee virali personalizzate e la fiducia per pubblicarle.",
    signal1: "Prompt personalizzati ogni giorno",
    signal2: "Feedback adatto alla tua voce",
    signal3: "Niente fuffa. Solo chiarezza.",
    socialProofTitle: "I creator amano PostPilot",
    socialProofSubtitle: "Unisciti a migliaia di creator che hanno ritrovato fiducia",
    testimonial1Quote: "\"Ha davvero analizzato il mio Instagram e mi ha detto cosa vede il mio pubblico.\"",
    testimonial1Role: "Coach di liberta e scopo",
    testimonial2Quote: "\"Mi ha ridato fiducia nella mia voce - finalmente sapevo cosa dire.\"",
    testimonial2Role: "Coach di vita e fitness",
    testimonial3Quote: "\"Mi ha detto la verita - niente fronzoli, niente lodi finte. Esattamente cio che mi serviva.\"",
    testimonial3Role: "Coach salute e benessere",
    achieveTitle: "Cosa otterrai",
    achieveSubtitle: "PostPilot non ti da solo idee. Trasforma il tuo modo di creare.",
    feature1Title: "Fai crescere il pubblico piu velocemente",
    feature1Text: "Contenuti costanti e di qualita che risuonano con i follower ideali",
    feature2Title: "Trova il tuo ritmo creativo",
    feature2Text: "Scopri cosa funziona per te e trasformalo nel tuo stile distintivo",
    feature3Title: "Presentati con fiducia ogni giorno",
    feature3Text: "Niente piu overthinking o dubbi continui sui contenuti",
    feature4Title: "Trasforma il postare da fatica ad abitudine",
    feature4Text: "Rendi la creazione di contenuti naturale, non forzata",
    comingSoonBadge: "In arrivo",
    comingSoonTitle: "Questo e solo l'inizio",
    comingSoonSubtitle: "Abbiamo nuove funzionalita entusiasmanti in arrivo.",
    chip1: "Editor video con AI",
    chip2: "Pannello analisi e metriche",
    chip3: "Generatore di caroselli",
    chip4: "Scheduler giornaliero contenuti",
    chip5: "Archivio idee contenuti",
    finalCtaTitle: "Non ti serve un altro tool per contenuti.",
    finalCtaSubtitle: "Ti serve un coach che ti aiuti a credere nelle tue idee.",
    finalCtaClosing: "Questo e PostPilot.",
    finalCtaGuarantee: "Annulla quando vuoi - Garanzia rimborso 100%",
    finalLegalNote: "PostPilot Labs 2026 - Creato per creator indipendenti.",
    signupTitle: "Inizia la prova gratuita",
    continueGoogle: "Continua con Google",
    or: "oppure",
    fullName: "Nome completo",
    emailAddress: "Indirizzo email",
    password: "Password",
    tipsOptIn: "Inviami consigli per creator e altre opportunita",
    createAccount: "Crea account",
    guarantee1: "Garanzia soddisfatti o rimborsati 30 giorni",
    guarantee2: "Annulla quando vuoi - Nessuna domanda",
    alreadyAccount: "Hai gia un account?",
    signIn: "Accedi",
    newChat: "Reset chat",
    settings: "Impostazioni",
    disconnect: "Disconnetti",
    chatSubtitle: "Il tuo assistente per la crescita creator",
    chatInputPlaceholder: "Messaggio per PostPilot Agent",
    suggestionsLabel: "Suggerimenti",
    suggestions: [
      { icon: "📊", label: "Analizza le performance", prompt: "Analizza le mie ultime performance e dimmi cosa migliorare" },
      { icon: "✏️", label: "Genera bozza post", prompt: "Scrivi una bozza di post basata sulla mia nicchia e sui contenuti recenti piu performanti" },
      { icon: "📅", label: "Piano settimanale contenuti", prompt: "Crea il mio piano settimanale di contenuti con idee specifiche per ogni giorno" },
      { icon: "♻️", label: "Riutilizza un post", prompt: "Prendi il mio post piu performante e trasformalo in 3 formati diversi" },
      { icon: "💬", label: "Idee per descrizioni", prompt: "Dammi 5 idee di descrizioni coinvolgenti basate sulla mia nicchia e il mio pubblico" },
      { icon: "🚀", label: "Consigli di crescita", prompt: "Quali sono le 3 cose principali che dovrei cambiare per crescere piu velocemente sui social?" },
    ],
    analyticsTotalPosts: "Post totali",
    analyticsTotalLikes: "Like totali",
    analyticsTotalComments: "Commenti totali",
    analyticsAvgEngagement: "Interazione media / post",
    analyticsEngagementTrend: "Interazioni nel tempo",
    analyticsPerformanceByType: "Performance per tipo di contenuto",
    analyticsBestDay: "Giorno migliore per postare",
    analyticsCaptionLength: "Lunghezza descrizione vs interazioni",
    analyticsTopPosts: "Top post per interazioni",
    chartLikes: "Like",
    chartComments: "Commenti",
    chartPosts: "Post",
    chartAvgEngagement: "Interazione media",
    chartCaptionLengthAxis: "Lunghezza descrizione (caratteri)",
    chartEngagementAxis: "Interazioni",
    chartAvgEngShort: "Int. media",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Tu",
    send: "Invia",
    saveSettings: "Salva impostazioni",
    onboardingRequired: "Completa l'onboarding quando vuoi. Mi servono questi dettagli prima di aiutarti.",
    disconnectToast: "Disconnesso. Accedi di nuovo quando vuoi.",
    newChatStarted: "Nuova chat avviata. Chiedi bozze, analisi, repurposing o un piano settimanale.",
    onboardingDone: "Onboarding completato. Sono pronto ad aiutarti con la tua strategia contenuti.",
    settingsSaved: "Impostazioni salvate. Ho aggiornato il profilo e le fonti contenuto.",
    initialAssistant: "Sono il tuo agente AI per i contenuti. Completa l'onboarding e poi chiedi bozze, analisi o piani settimanali.",
    signInModalTitle: "Accedi a PostPilot",
    signInSubmit: "Accedi",
    signinPasswordPh: "Inserisci la password",
    signupPhFullName: "Inserisci il nome completo",
    signupPhEmail: "tu@esempio.com",
    signupPhPassword: "Crea una password",
    accountPhName: "Il tuo nome",
    accountPhEmail: "tu@dominio.com",
    onboardingCreateTitle: "Crea il tuo account",
    onboardingCreateSubtitle: "Imposta il profilo creator per sbloccare l'agente AI.",
    onboardingFormTitle: "Completa l'onboarding",
    onboardingFormSubtitle:
      "Parlaci di nicchia e obiettivo principale. Puoi collegare LinkedIn e Instagram piu tardi in Impostazioni.",
    onboardPhNiche: "es. educazione creator per coach",
    onboardPhObjective: "es. aumentare i lead dal contenuto",
    shortName: "Nome",
    shortEmail: "Email",
    nicheLabel: "Nicchia",
    objectiveShort: "Obiettivo",
    onboardObjectiveLabel: "Obiettivo principale",
    linkedinUsername: "Username LinkedIn",
    instagramUsername: "Username Instagram",
    completeOnboarding: "Completa onboarding",
    settingsModalHeading: "Impostazioni",
    tabGeneral: "Generale",
    tabAccount: "Account",
    tabConnections: "Connessioni",
    panelGeneral: "Generale",
    panelAccount: "Account",
    panelConnections: "Connessioni",
    settingsNicheHint: "Angolo dei contenuti e pubblico di riferimento.",
    settingsObjectiveHint: "Risultato di crescita principale per questo trimestre.",
    onboardingKicker: "Inizia ora",
    paymentModeTitle: "Attiva il tuo piano",
    paymentModeSubtitle: "Completa l'abbonamento da 30 EUR/mese per sbloccare il coach AI.",
    onboardingExplainerTitle: "Cosa fa PostPilot",
    onboardingExplainerBody: "Analizza i tuoi contenuti, identifica pattern di crescita e offre azioni pratiche settimanali, bozze e feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Attiva il tuo abbonamento",
    paymentPriceSuffix: " / mese",
    paymentFeature1: "Accesso completo alla chat di coaching AI",
    paymentFeature2: "Strategia contenuti e generazione bozze",
    paymentFeature3: "Pianificazione settimanale e insight sulle performance",
    paymentAgree: "Accetto di avviare un abbonamento mensile da 30 EUR.",
    paymentSubmit: "Completa pagamento",
    paymentRequiredBeforeContinuing: "Il pagamento e richiesto prima di continuare.",
    paymentCompleteToContinue: "Completa il pagamento per continuare.",
    paymentEndpointUnavailable: "Endpoint di pagamento non disponibile. Riavvia il server e riprova.",
    onboardingMissingFields: "Completa nicchia e obiettivo per continuare.",
    paymentConfirmTerms: "Conferma i termini dell'abbonamento.",
    paymentCheckoutSessionError: "Impossibile creare la sessione Stripe Checkout.",
    checkoutCanceled: "Checkout annullato. Completa il pagamento per sbloccare il coach AI.",
    checkoutProcessing: "Pagamento inviato. Verifica dell'abbonamento in corso...",
    googleConnected: "Connesso con Google.",
  },
  de: {
    language: "Sprache",
    heroBadge: "Fruehzugang - Zeitlich begrenztes Angebot",
    heroTitleMain: "Baue deine Reichweite aus.",
    heroTitleAccent: "Mit deinem eigenen KI-Coach.",
    heroSubtitle: "Erhalte taeglich personalisierte virale Ideen und das Vertrauen, sie zu posten.",
    signal1: "Taegliche individuelle Prompts",
    signal2: "Feedback passend zu deiner Stimme",
    signal3: "Kein BlaBla. Nur Klarheit.",
    socialProofTitle: "Creator lieben PostPilot",
    socialProofSubtitle: "Schliesse dich Tausenden an, die kreatives Selbstvertrauen gefunden haben",
    testimonial1Quote: "\"Es hat sich mein Instagram wirklich angesehen und mir gesagt, was mein Publikum sieht.\"",
    testimonial1Role: "Coach fuer Freiheit und Sinn",
    testimonial2Quote: "\"Es hat mir wieder Vertrauen in meine Stimme gegeben - als wuesste ich endlich, was ich sagen soll.\"",
    testimonial2Role: "Life- und Fitness-Coach",
    testimonial3Quote: "\"Es hat mir die Wahrheit gesagt - ohne Floskeln, ohne falsches Lob. Genau das, was ich brauchte.\"",
    testimonial3Role: "Gesundheits- und Wellness-Coach",
    achieveTitle: "Was du erreichen wirst",
    achieveSubtitle: "PostPilot gibt dir nicht nur Ideen. Es veraendert, wie du Content erstellst.",
    feature1Title: "Baue dein Publikum schneller auf",
    feature1Text: "Konstanter, hochwertiger Content, der bei deinen idealen Followern ankommt",
    feature2Title: "Finde deinen kreativen Rhythmus",
    feature2Text: "Entdecke, was fuer dich funktioniert, und mache es zu deinem Signature-Style",
    feature3Title: "Zeig dich taeglich selbstbewusst",
    feature3Text: "Kein Overthinking und kein ständiges Zweifeln mehr",
    feature4Title: "Mach Posten von einer Pflicht zur Gewohnheit",
    feature4Text: "Lass Content-Erstellung natuerlich statt erzwungen wirken",
    comingSoonBadge: "Demnaechst",
    comingSoonTitle: "Das ist erst der Anfang",
    comingSoonSubtitle: "Neue spannende Funktionen sind bereits auf dem Weg.",
    chip1: "KI-Videoeditor",
    chip2: "Uebersicht zu Reichweite und Kennzahlen",
    chip3: "Karussell-Generator",
    chip4: "Taeglicher Content-Planer",
    chip5: "Content-Ideenbank",
    finalCtaTitle: "Du brauchst kein weiteres Content-Tool.",
    finalCtaSubtitle: "Du brauchst einen Coach, der dir hilft, an deine Ideen zu glauben.",
    finalCtaClosing: "Das ist PostPilot.",
    finalCtaGuarantee: "Jederzeit kuendbar - 100% Geld-zurueck-Garantie",
    finalLegalNote: "PostPilot Labs 2026 - Entwickelt fuer unabhaengige Creator.",
    signupTitle: "Starte deine kostenlose Testphase",
    continueGoogle: "Mit Google fortfahren",
    or: "oder",
    fullName: "Vollstaendiger Name",
    emailAddress: "E-Mail-Adresse",
    password: "Passwort",
    tipsOptIn: "Sende mir Creator-Tipps und weitere Moeglichkeiten",
    createAccount: "Konto erstellen",
    guarantee1: "30 Tage Geld-zurueck-Garantie",
    guarantee2: "Jederzeit kuendbar - Ohne Rueckfragen",
    alreadyAccount: "Du hast bereits ein Konto?",
    signIn: "Anmelden",
    newChat: "Reset chat",
    settings: "Einstellungen",
    disconnect: "Trennen",
    chatSubtitle: "Dein Assistent fuer Creator-Wachstum",
    chatInputPlaceholder: "Nachricht an PostPilot Agent",
    suggestionsLabel: "Vorschlaege",
    suggestions: [
      { icon: "📊", label: "Performance analysieren", prompt: "Analysiere meine letzte Performance und sage mir, was ich verbessern soll" },
      { icon: "✏️", label: "Post-Entwurf erstellen", prompt: "Schreibe einen Post-Entwurf basierend auf meiner Nische und meinen besten Inhalten" },
      { icon: "📅", label: "Wochenplan erstellen", prompt: "Erstelle meinen woechentlichen Content-Plan mit konkreten Post-Ideen fuer jeden Tag" },
      { icon: "♻️", label: "Beitrag wiederverwerten", prompt: "Nimm meinen erfolgreichsten Beitrag und verwandle ihn in 3 verschiedene Formate" },
      { icon: "💬", label: "Beschreibungsideen", prompt: "Gib mir 5 ansprechende Beschreibungsideen basierend auf meiner Nische und Zielgruppe" },
      { icon: "🚀", label: "Wachstumstipps", prompt: "Was sind die 3 wichtigsten Dinge, die ich aendern sollte, um schneller in Social Media zu wachsen?" },
    ],
    analyticsTotalPosts: "Beitraege gesamt",
    analyticsTotalLikes: "Likes gesamt",
    analyticsTotalComments: "Kommentare gesamt",
    analyticsAvgEngagement: "Durchschn. Interaktion / Beitrag",
    analyticsEngagementTrend: "Interaktionen im Zeitverlauf",
    analyticsPerformanceByType: "Performance nach Inhaltstyp",
    analyticsBestDay: "Bester Tag zum Posten",
    analyticsCaptionLength: "Beschreibungslaenge vs Interaktion",
    analyticsTopPosts: "Top-Beitraege nach Interaktion",
    chartLikes: "Likes",
    chartComments: "Kommentare",
    chartPosts: "Beitraege",
    chartAvgEngagement: "Durchschn. Interaktion",
    chartCaptionLengthAxis: "Beschreibungslaenge (Zeichen)",
    chartEngagementAxis: "Interaktion",
    chartAvgEngShort: "Durchschn.",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Du",
    send: "Senden",
    saveSettings: "Einstellungen speichern",
    onboardingRequired: "Schliesse das Onboarding ab, wenn du bereit bist. Ich brauche diese Angaben, bevor ich helfen kann.",
    disconnectToast: "Getrennt. Melde dich wieder an, wenn du bereit bist.",
    newChatStarted: "Neuer Chat gestartet. Frage nach Entwuerfen, Analysen, Repurposing oder Wochenplan.",
    onboardingDone: "Onboarding abgeschlossen. Ich bin bereit, deine Content-Strategie zu coachen.",
    settingsSaved: "Einstellungen gespeichert. Ich habe dein Profil und deine Content-Quellen aktualisiert.",
    initialAssistant: "Ich bin dein KI-Content-Agent. Schliess das Onboarding ab und frage dann nach Entwuerfen, Analysen oder Wochenplaenen.",
    signInModalTitle: "Bei PostPilot anmelden",
    signInSubmit: "Anmelden",
    signinPasswordPh: "Passwort eingeben",
    signupPhFullName: "Vollstaendigen Namen eingeben",
    signupPhEmail: "du@beispiel.de",
    signupPhPassword: "Passwort festlegen",
    accountPhName: "Dein Name",
    accountPhEmail: "du@domain.de",
    onboardingCreateTitle: "Konto erstellen",
    onboardingCreateSubtitle: "Richte dein Creator-Profil ein, um den KI-Agenten freizuschalten.",
    onboardingFormTitle: "Onboarding abschliessen",
    onboardingFormSubtitle:
      "Erzaehl uns von deiner Nische und deinem Hauptziel. LinkedIn und Instagram kannst du spaeter unter Einstellungen verbinden.",
    onboardPhNiche: "z.B. Creator-Bildung fuer Coaches",
    onboardPhObjective: "z.B. mehr Inbound-Leads durch Content",
    shortName: "Name",
    shortEmail: "E-Mail",
    nicheLabel: "Nische",
    objectiveShort: "Ziel",
    onboardObjectiveLabel: "Hauptziel",
    linkedinUsername: "LinkedIn-Benutzername",
    instagramUsername: "Instagram-Benutzername",
    completeOnboarding: "Onboarding abschliessen",
    settingsModalHeading: "Einstellungen",
    tabGeneral: "Allgemein",
    tabAccount: "Konto",
    tabConnections: "Verbindungen",
    panelGeneral: "Allgemein",
    panelAccount: "Konto",
    panelConnections: "Verbindungen",
    settingsNicheHint: "Dein Content-Fokus und deine Zielgruppe.",
    settingsObjectiveHint: "Das wichtigste Wachstumsziel fuer dieses Quartal.",
    onboardingKicker: "Loslegen",
    paymentModeTitle: "Aktiviere deinen Plan",
    paymentModeSubtitle: "Schliesse dein Abo fuer 30 EUR/Monat ab, um den KI-Coach freizuschalten.",
    onboardingExplainerTitle: "Was PostPilot macht",
    onboardingExplainerBody: "Analysiert deinen Content, erkennt Wachstumsmuster und gibt praktische woechentliche Aktionen, Entwuerfe und Feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Aktiviere dein Abonnement",
    paymentPriceSuffix: " / Monat",
    paymentFeature1: "Voller Zugriff auf den KI-Coaching-Chat",
    paymentFeature2: "Content-Strategie und Entwurfsgenerierung",
    paymentFeature3: "Woechentliche Planung und Performance-Insights",
    paymentAgree: "Ich stimme zu, ein monatliches Abo fuer 30 EUR zu starten.",
    paymentSubmit: "Zahlung abschliessen",
    paymentRequiredBeforeContinuing: "Eine Zahlung ist erforderlich, bevor du fortfaehrst.",
    paymentCompleteToContinue: "Schliesse die Zahlung ab, um fortzufahren.",
    paymentEndpointUnavailable: "Payment-Endpunkt ist nicht verfuegbar. Starte den Server neu und versuche es erneut.",
    onboardingMissingFields: "Bitte Nische und Ziel ausfuellen, um fortzufahren.",
    paymentConfirmTerms: "Bitte bestaetige die Abonnementbedingungen.",
    paymentCheckoutSessionError: "Stripe-Checkout-Session konnte nicht erstellt werden.",
    checkoutCanceled: "Checkout wurde abgebrochen. Schliesse die Zahlung ab, um den KI-Coach freizuschalten.",
    checkoutProcessing: "Zahlung eingegangen. Abonnement wird verifiziert...",
    googleConnected: "Mit Google verbunden.",
  },
  fr: {
    language: "Langue",
    heroBadge: "Acces Anticipe - Offre Limitee",
    heroTitleMain: "Developpez votre audience.",
    heroTitleAccent: "Avec votre coach IA personnel.",
    heroSubtitle: "Recevez chaque jour une idee virale personnalisee et la confiance pour la publier.",
    signal1: "Prompts personnalises chaque jour",
    signal2: "Feedback adapte a votre voix",
    signal3: "Sans blabla. Juste de la clarte.",
    socialProofTitle: "Les createurs adorent PostPilot",
    socialProofSubtitle: "Rejoignez des milliers de createurs qui ont retrouve leur confiance",
    testimonial1Quote: "\"Il a vraiment analyse mon Instagram et m'a dit ce que mon audience voyait.\"",
    testimonial1Role: "Coach liberte et mission",
    testimonial2Quote: "\"Il m'a redonne confiance en ma voix - comme si je savais enfin quoi dire.\"",
    testimonial2Role: "Coach vie et fitness",
    testimonial3Quote: "\"Il m'a dit la verite - sans blabla, sans faux compliments. Exactement ce qu'il me fallait.\"",
    testimonial3Role: "Coach sante et bien-etre",
    achieveTitle: "Ce que vous allez accomplir",
    achieveSubtitle: "PostPilot ne vous donne pas seulement des idees. Il transforme votre facon de creer.",
    feature1Title: "Developpez votre audience plus vite",
    feature1Text: "Un contenu regulier et de qualite qui parle a vos abonnes ideaux",
    feature2Title: "Trouvez votre rythme creatif",
    feature2Text: "Decouvrez ce qui fonctionne pour vous et transformez-le en style signature",
    feature3Title: "Soyez present avec confiance chaque jour",
    feature3Text: "Fini le surmenage mental et les doutes constants sur votre contenu",
    feature4Title: "Transformez la publication en habitude",
    feature4Text: "Rendez la creation de contenu naturelle, pas forcee",
    comingSoonBadge: "Bientot",
    comingSoonTitle: "Ce n'est que le debut",
    comingSoonSubtitle: "De nouvelles fonctionnalites passionnantes arrivent.",
    chip1: "Editeur video IA",
    chip2: "Tableau des performances et indicateurs",
    chip3: "Generateur de carrousels",
    chip4: "Planificateur quotidien de contenu",
    chip5: "Bibliotheque d'idees de contenu",
    finalCtaTitle: "Vous n'avez pas besoin d'un autre outil de contenu.",
    finalCtaSubtitle: "Vous avez besoin d'un coach qui vous aide a croire en vos idees.",
    finalCtaClosing: "C'est PostPilot.",
    finalCtaGuarantee: "Annulez a tout moment - garantie 100% satisfait ou rembourse",
    finalLegalNote: "PostPilot Labs 2026 - Concu pour les createurs independants.",
    signupTitle: "Demarrez votre essai gratuit",
    continueGoogle: "Continuer avec Google",
    or: "ou",
    fullName: "Nom complet",
    emailAddress: "Adresse e-mail",
    password: "Mot de passe",
    tipsOptIn: "Envoyez-moi des conseils createur et d'autres opportunites",
    createAccount: "Creer un compte",
    guarantee1: "Garantie remboursement 30 jours",
    guarantee2: "Annulez a tout moment - Sans question",
    alreadyAccount: "Vous avez deja un compte ?",
    signIn: "Se connecter",
    newChat: "Reset chat",
    settings: "Parametres",
    disconnect: "Deconnexion",
    chatSubtitle: "Votre assistant de croissance createur",
    chatInputPlaceholder: "Message a PostPilot Agent",
    suggestionsLabel: "Suggestions",
    suggestions: [
      { icon: "📊", label: "Analyser les performances", prompt: "Analyse mes dernieres performances et dis-moi quoi ameliorer" },
      { icon: "✏️", label: "Generer un brouillon", prompt: "Ecris un brouillon de publication base sur ma niche et mes contenus les plus performants" },
      { icon: "📅", label: "Plan hebdomadaire", prompt: "Cree mon plan de contenu hebdomadaire avec des idees de publications pour chaque jour" },
      { icon: "♻️", label: "Reutiliser une publication", prompt: "Prends ma publication la plus performante et transforme-la en 3 formats differents" },
      { icon: "💬", label: "Idees de descriptions", prompt: "Donne-moi 5 idees de descriptions engageantes basees sur ma niche et mon audience" },
      { icon: "🚀", label: "Conseils de croissance", prompt: "Quels sont les 3 changements les plus importants que je devrais faire pour grandir plus vite sur les reseaux sociaux ?" },
    ],
    analyticsTotalPosts: "Total publications",
    analyticsTotalLikes: "Total mentions j'aime",
    analyticsTotalComments: "Total commentaires",
    analyticsAvgEngagement: "Interaction moy. / publication",
    analyticsEngagementTrend: "Interactions dans le temps",
    analyticsPerformanceByType: "Performance par type de contenu",
    analyticsBestDay: "Meilleur jour pour publier",
    analyticsCaptionLength: "Longueur de description vs interactions",
    analyticsTopPosts: "Top publications par interactions",
    chartLikes: "J'aime",
    chartComments: "Commentaires",
    chartPosts: "Publications",
    chartAvgEngagement: "Interaction moyenne",
    chartCaptionLengthAxis: "Longueur description (caracteres)",
    chartEngagementAxis: "Interactions",
    chartAvgEngShort: "Int. moy.",
    msgSenderAssistant: "PostPilot",
    msgSenderUser: "Vous",
    send: "Envoyer",
    saveSettings: "Enregistrer les parametres",
    onboardingRequired: "Completez l'onboarding quand vous voulez. J'ai besoin de ces infos avant de vous aider.",
    disconnectToast: "Deconnecte. Reconnectez-vous quand vous voulez.",
    newChatStarted: "Nouveau chat demarre. Demandez des brouillons, analyses, reutilisation ou un plan hebdomadaire.",
    onboardingDone: "Onboarding termine. Je suis pret a vous aider sur votre strategie de contenu.",
    settingsSaved: "Parametres enregistres. J'ai actualise votre profil et vos sources de contenu.",
    initialAssistant: "Je suis votre agent IA de contenu. Terminez l'onboarding puis demandez des brouillons, analyses ou plans hebdomadaires.",
    signInModalTitle: "Connexion a PostPilot",
    signInSubmit: "Se connecter",
    signinPasswordPh: "Saisissez votre mot de passe",
    signupPhFullName: "Saisissez votre nom complet",
    signupPhEmail: "vous@exemple.com",
    signupPhPassword: "Creez un mot de passe",
    accountPhName: "Votre nom",
    accountPhEmail: "vous@domaine.com",
    onboardingCreateTitle: "Creer votre compte",
    onboardingCreateSubtitle: "Configurez votre profil createur pour activer l'agent IA.",
    onboardingFormTitle: "Terminer l'onboarding",
    onboardingFormSubtitle:
      "Parlez-nous de votre niche et de votre objectif principal. Vous pourrez connecter LinkedIn et Instagram plus tard dans Parametres.",
    onboardPhNiche: "ex. education createurs pour coachs",
    onboardPhObjective: "ex. augmenter les leads via le contenu",
    shortName: "Nom",
    shortEmail: "E-mail",
    nicheLabel: "Niche",
    objectiveShort: "Objectif",
    onboardObjectiveLabel: "Objectif principal",
    linkedinUsername: "Nom d'utilisateur LinkedIn",
    instagramUsername: "Nom d'utilisateur Instagram",
    completeOnboarding: "Terminer l'onboarding",
    settingsModalHeading: "Parametres",
    tabGeneral: "General",
    tabAccount: "Compte",
    tabConnections: "Connexions",
    panelGeneral: "General",
    panelAccount: "Compte",
    panelConnections: "Connexions",
    settingsNicheHint: "Votre angle de contenu et votre audience.",
    settingsObjectiveHint: "Le principal objectif de croissance pour ce trimestre.",
    onboardingKicker: "Commencer",
    paymentModeTitle: "Activez votre plan",
    paymentModeSubtitle: "Finalisez votre abonnement de 30 EUR/mois pour debloquer le coach IA.",
    onboardingExplainerTitle: "Ce que fait PostPilot",
    onboardingExplainerBody: "Analyse votre contenu, identifie les tendances de croissance et fournit des actions hebdomadaires pratiques, des brouillons et du feedback.",
    paymentPlanLabel: "PostPilot Pro",
    paymentActivateTitle: "Activez votre abonnement",
    paymentPriceSuffix: " / mois",
    paymentFeature1: "Acces complet au chat de coaching IA",
    paymentFeature2: "Strategie de contenu et generation de brouillons",
    paymentFeature3: "Planification hebdomadaire et insights de performance",
    paymentAgree: "J'accepte de demarrer un abonnement mensuel de 30 EUR.",
    paymentSubmit: "Finaliser le paiement",
    paymentRequiredBeforeContinuing: "Le paiement est requis avant de continuer.",
    paymentCompleteToContinue: "Finalisez le paiement pour continuer.",
    paymentEndpointUnavailable: "Le point de terminaison de paiement est indisponible. Redemarrez le serveur puis reessayez.",
    onboardingMissingFields: "Completez la niche et l'objectif pour continuer.",
    paymentConfirmTerms: "Veuillez confirmer les conditions de l'abonnement.",
    paymentCheckoutSessionError: "Impossible de creer la session Stripe Checkout.",
    checkoutCanceled: "Le checkout a ete annule. Finalisez le paiement pour debloquer le coach IA.",
    checkoutProcessing: "Paiement recu. Verification de l'abonnement en cours...",
    googleConnected: "Connecte avec Google.",
  },
};

function t(key) {
  return I18N[currentLanguage]?.[key] || I18N.en[key] || key;
}

function tf(key, replacements = {}) {
  let text = t(key);
  for (const [name, value] of Object.entries(replacements)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function setTextIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setPlaceholderIfExists(id, value) {
  const el = document.getElementById(id);
  if (el) el.placeholder = value;
}

function setGoogleButtonLabel(button, label) {
  if (!button) return;
  const labelEl = button.querySelector("span");
  if (labelEl) {
    labelEl.textContent = label;
    return;
  }
  button.textContent = label;
}

function syncOnboardingLanguage() {
  const modal = document.getElementById("onboardingModal");
  if (!modal || modal.classList.contains("hidden")) return;
  const isCreate = !document.getElementById("accountForm").classList.contains("hidden");
  const isOnboarding = !document.getElementById("onboardingForm").classList.contains("hidden");
  const mode = isCreate ? "create" : isOnboarding ? "onboarding" : "payment";
  setOnboardingMode(mode);
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  if (languageSelect) languageSelect.value = currentLanguage;

  setTextIfExists("languageLabel", t("language"));
  setTextIfExists("heroBadge", t("heroBadge"));
  setTextIfExists("heroTitleMain", t("heroTitleMain"));
  setTextIfExists("heroTitleAccent", t("heroTitleAccent"));
  setTextIfExists("heroSubtitle", t("heroSubtitle"));
  setTextIfExists("signal1", t("signal1"));
  setTextIfExists("signal2", t("signal2"));
  setTextIfExists("signal3", t("signal3"));
  setTextIfExists("socialProofTitle", t("socialProofTitle"));
  setTextIfExists("socialProofSubtitle", t("socialProofSubtitle"));
  setTextIfExists("testimonial1Quote", t("testimonial1Quote"));
  setTextIfExists("testimonial1Role", t("testimonial1Role"));
  setTextIfExists("testimonial2Quote", t("testimonial2Quote"));
  setTextIfExists("testimonial2Role", t("testimonial2Role"));
  setTextIfExists("testimonial3Quote", t("testimonial3Quote"));
  setTextIfExists("testimonial3Role", t("testimonial3Role"));
  setTextIfExists("achieveTitle", t("achieveTitle"));
  setTextIfExists("achieveSubtitle", t("achieveSubtitle"));
  setTextIfExists("feature1Title", t("feature1Title"));
  setTextIfExists("feature1Text", t("feature1Text"));
  setTextIfExists("feature2Title", t("feature2Title"));
  setTextIfExists("feature2Text", t("feature2Text"));
  setTextIfExists("feature3Title", t("feature3Title"));
  setTextIfExists("feature3Text", t("feature3Text"));
  setTextIfExists("feature4Title", t("feature4Title"));
  setTextIfExists("feature4Text", t("feature4Text"));
  setTextIfExists("comingSoonBadge", t("comingSoonBadge"));
  setTextIfExists("comingSoonTitle", t("comingSoonTitle"));
  setTextIfExists("comingSoonSubtitle", t("comingSoonSubtitle"));
  setTextIfExists("chip1", t("chip1"));
  setTextIfExists("chip2", t("chip2"));
  setTextIfExists("chip3", t("chip3"));
  setTextIfExists("chip4", t("chip4"));
  setTextIfExists("chip5", t("chip5"));
  setTextIfExists("finalCtaTitle", t("finalCtaTitle"));
  setTextIfExists("finalCtaSubtitle", t("finalCtaSubtitle"));
  setTextIfExists("finalCtaClosing", t("finalCtaClosing"));
  setTextIfExists("finalCtaGuarantee", t("finalCtaGuarantee"));
  setTextIfExists("finalLegalNote", t("finalLegalNote"));
  if (openTrialBtn) openTrialBtn.textContent = t("signupTitle");
  setTextIfExists("signupTitle", t("signupTitle"));
  setTextIfExists("signupFullNameLabel", t("fullName"));
  setTextIfExists("signupEmailLabel", t("emailAddress"));
  setTextIfExists("signupPasswordLabel", t("password"));
  setTextIfExists("tipsOptInLabel", t("tipsOptIn"));
  setTextIfExists("signupSubmitBtn", t("createAccount"));
  setTextIfExists("signupGuarantee1", t("guarantee1"));
  setTextIfExists("signupGuarantee2", t("guarantee2"));
  setTextIfExists("alreadyAccountText", t("alreadyAccount"));
  setTextIfExists("openSignin", t("signIn"));
  setTextIfExists("agentViewBtnLabel", t("agentView"));
  setTextIfExists("analyticsViewBtnLabel", t("analyticsView"));
  setTextIfExists("resetChatBtnLabel", t("newChat"));
  setTextIfExists("settingsBtnLabel", t("settings"));
  setTextIfExists("disconnectBtnLabel", t("disconnect"));
  setTextIfExists("chatHeaderSubtitle", t("chatSubtitle"));
  setTextIfExists("labelTotalPosts", t("analyticsTotalPosts"));
  setTextIfExists("labelTotalLikes", t("analyticsTotalLikes"));
  setTextIfExists("labelTotalComments", t("analyticsTotalComments"));
  setTextIfExists("labelAvgEngagement", t("analyticsAvgEngagement"));
  setTextIfExists("titleEngagementTrend", t("analyticsEngagementTrend"));
  setTextIfExists("titlePerformanceByType", t("analyticsPerformanceByType"));
  setTextIfExists("titleBestDay", t("analyticsBestDay"));
  setTextIfExists("titleCaptionLength", t("analyticsCaptionLength"));
  setTextIfExists("titleTopPosts", t("analyticsTopPosts"));
  setTextIfExists("sendBtn", t("send"));
  setTextIfExists("settingsSaveBtn", t("saveSettings"));

  const messageInput = document.getElementById("messageInput");
  if (messageInput) messageInput.placeholder = t("chatInputPlaceholder");

  buildSuggestionsPopup();

  setGoogleButtonLabel(googleSignupBtn, t("continueGoogle"));
  setGoogleButtonLabel(googleSigninBtn, t("continueGoogle"));
  const dividers = document.querySelectorAll(".divider");
  for (const divider of dividers) divider.textContent = t("or");

  setPlaceholderIfExists("signupFullName", t("signupPhFullName"));
  setPlaceholderIfExists("signupEmail", t("signupPhEmail"));
  setPlaceholderIfExists("signupPassword", t("signupPhPassword"));

  setTextIfExists("signinTitle", t("signInModalTitle"));
  setTextIfExists("signinEmailLabelText", t("emailAddress"));
  setTextIfExists("signinPasswordLabelText", t("password"));
  setTextIfExists("signinSubmitBtn", t("signInSubmit"));
  setPlaceholderIfExists("signinEmail", t("signupPhEmail"));
  setPlaceholderIfExists("signinPassword", t("signinPasswordPh"));

  setTextIfExists("accountFormNameLabel", t("shortName"));
  setTextIfExists("accountFormEmailLabel", t("shortEmail"));
  setTextIfExists("accountFormSubmitBtn", t("createAccount"));
  setPlaceholderIfExists("accountName", t("accountPhName"));
  setPlaceholderIfExists("accountEmail", t("accountPhEmail"));

  setTextIfExists("onboardNicheLabel", t("nicheLabel"));
  setTextIfExists("onboardObjectiveLabel", t("onboardObjectiveLabel"));
  setTextIfExists("onboardingFormSubmitBtn", t("completeOnboarding"));
  setTextIfExists("onboardingKicker", t("onboardingKicker"));
  setTextIfExists("onboardingExplainerTitle", t("onboardingExplainerTitle"));
  setTextIfExists("onboardingExplainerBody", t("onboardingExplainerBody"));
  setTextIfExists("paymentPlanLabel", t("paymentPlanLabel"));
  setTextIfExists("paymentActivateTitle", t("paymentActivateTitle"));
  setTextIfExists("paymentPriceSuffix", t("paymentPriceSuffix"));
  setTextIfExists("paymentFeature1", t("paymentFeature1"));
  setTextIfExists("paymentFeature2", t("paymentFeature2"));
  setTextIfExists("paymentFeature3", t("paymentFeature3"));
  setTextIfExists("paymentAgreeText", t("paymentAgree"));
  setTextIfExists("paymentSubmitBtn", t("paymentSubmit"));
  setPlaceholderIfExists("onboardNiche", t("onboardPhNiche"));
  setPlaceholderIfExists("onboardObjective", t("onboardPhObjective"));

  setTextIfExists("settingsModalTitle", t("settingsModalHeading"));
  setTextIfExists("settingsNavGeneral", t("tabGeneral"));
  setTextIfExists("settingsNavAccount", t("tabAccount"));
  setTextIfExists("settingsNavConnections", t("tabConnections"));
  setTextIfExists("settingsPanelGeneralTitle", t("panelGeneral"));
  setTextIfExists("settingsNicheTitle", t("nicheLabel"));
  setTextIfExists("settingsNicheHint", t("settingsNicheHint"));
  setTextIfExists("settingsObjectiveTitle", t("objectiveShort"));
  setTextIfExists("settingsObjectiveHint", t("settingsObjectiveHint"));
  setTextIfExists("settingsPanelAccountTitle", t("panelAccount"));
  setTextIfExists("settingsNameTitle", t("shortName"));
  setTextIfExists("settingsEmailTitle", t("shortEmail"));
  setTextIfExists("settingsPanelConnectionsTitle", t("panelConnections"));
  setTextIfExists("settingsLinkedinTitle", t("linkedinUsername"));
  setTextIfExists("settingsInstagramTitle", t("instagramUsername"));
  setTextIfExists("settingsLinkedinStatus", t("notConnected"));
  setTextIfExists("settingsInstagramStatus", t("notConnected"));
  if (connectLinkedinBtn) connectLinkedinBtn.textContent = t("connectAccount");
  if (connectInstagramBtn) connectInstagramBtn.textContent = t("connectAccount");

  syncOnboardingLanguage();
  if (accountState) applySettingsForm(accountState);
}

if (languageSelect) {
  languageSelect.addEventListener("change", () => {
    currentLanguage = languageSelect.value;
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
    applyLanguage();
  });
}

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

function getAuthQueryState() {
  const params = new URLSearchParams(window.location.search);
  return {
    googleAuth: params.get("googleAuth"),
    authError: params.get("authError"),
    authDetail: params.get("authDetail"),
    source: params.get("source") || "signup",
    checkout: params.get("checkout"),
    integration: params.get("integration"),
    integrationAuth: params.get("integrationAuth"),
    integrationError: params.get("integrationError"),
    integrationDetail: params.get("integrationDetail"),
  };
}

function clearAuthQueryParams() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

function setText(id, content) {
  const el = document.getElementById(id);
  if (el) el.textContent = content;
}

function setAvatar(id, src, alt) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!src) {
    el.classList.add("hidden");
    el.removeAttribute("src");
    return;
  }
  el.classList.remove("hidden");
  el.src = src;
  if (alt) el.alt = alt;
}

function setHidden(id, hidden) {
  document.getElementById(id).classList.toggle("hidden", hidden);
}

function showOnboardingModal() {
  if (onboardingHideTimer) {
    window.clearTimeout(onboardingHideTimer);
    onboardingHideTimer = null;
  }
  onboardingModal.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    onboardingModal.classList.add("is-open");
  });
}

function hideOnboardingModal() {
  onboardingModal.classList.remove("is-open");
  if (onboardingHideTimer) {
    window.clearTimeout(onboardingHideTimer);
  }
  onboardingHideTimer = window.setTimeout(() => {
    onboardingModal.classList.add("hidden");
    onboardingHideTimer = null;
  }, 220);
}

function showToast(message) {
  authToast.textContent = message;
  authToast.classList.remove("hidden");
  window.setTimeout(() => authToast.classList.add("hidden"), 3500);
}

function showFeedback(target, message) {
  target.textContent = message;
}

function clearFeedback() {
  showFeedback(signupFeedback, "");
  showFeedback(signinFeedback, "");
}

function createMsgRow(role) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  const sender = document.createElement("div");
  sender.className = "msg-sender";
  sender.textContent = role === "assistant" ? t("msgSenderAssistant") : t("msgSenderUser");
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  row.appendChild(sender);
  row.appendChild(bubble);
  return { row, bubble };
}

function addMessage(role, content) {
  const messages = document.getElementById("messages");
  const { row, bubble } = createMsgRow(role);
  bubble.textContent = content;
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
}

function addStreamingMessage() {
  const messages = document.getElementById("messages");
  const { row, bubble } = createMsgRow("assistant");
  const cursor = document.createElement("span");
  cursor.className = "streaming-cursor";
  bubble.appendChild(cursor);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return {
    append(token) {
      bubble.insertBefore(document.createTextNode(token), cursor);
      messages.scrollTop = messages.scrollHeight;
    },
    finish() {
      cursor.remove();
    },
    element: bubble,
  };
}

async function streamChat(message, sessionId) {
  const res = await fetch("/api/agent/message/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const handle = addStreamingMessage();
  let buffer = "";
  let fullText = "";
  let lastAction = "ai_reply";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.token) {
            handle.append(data.token);
            fullText += data.token;
          }
          if (data.done) {
            lastAction = data.action || lastAction;
          }
          if (data.error) {
            handle.append(`\nError: ${data.error}`);
          }
        } catch (_e) { /* skip */ }
      }
    }
  } finally {
    handle.finish();
  }

  return { content: fullText, action: lastAction };
}

function sendPrompt(text) {
  const input = document.getElementById("messageInput");
  input.value = text;
  document.getElementById("composer").requestSubmit();
}

function setActiveView(view) {
  const showAnalytics = view === "analytics";
  agentView?.classList.toggle("hidden", showAnalytics);
  analyticsView?.classList.toggle("hidden", !showAnalytics);
  agentViewBtn?.classList.toggle("active", !showAnalytics);
  analyticsViewBtn?.classList.toggle("active", showAnalytics);
  if (resetChatBtn) resetChatBtn.classList.toggle("hidden", showAnalytics);
}

const analyticsCharts = {};

const CHART_COLORS = {
  pink: "rgba(194, 49, 96, 0.85)",
  pinkLight: "rgba(194, 49, 96, 0.15)",
  rose: "rgba(232, 121, 149, 0.85)",
  roseLight: "rgba(232, 121, 149, 0.15)",
  plum: "rgba(128, 30, 60, 0.85)",
  plumLight: "rgba(128, 30, 60, 0.15)",
  gold: "rgba(217, 164, 65, 0.85)",
  goldLight: "rgba(217, 164, 65, 0.15)",
  teal: "rgba(56, 161, 148, 0.85)",
  tealLight: "rgba(56, 161, 148, 0.15)",
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { font: { family: "Poppins", size: 11 }, boxWidth: 12, padding: 10 } },
    tooltip: { titleFont: { family: "Poppins" }, bodyFont: { family: "Poppins" } },
  },
  scales: {
    x: { ticks: { font: { family: "Poppins", size: 10 } }, grid: { display: false } },
    y: { ticks: { font: { family: "Poppins", size: 10 } }, grid: { color: "rgba(0,0,0,0.04)" }, beginAtZero: true },
  },
};

function destroyChart(id) {
  if (analyticsCharts[id]) { analyticsCharts[id].destroy(); delete analyticsCharts[id]; }
}

function renderStatCards(summary, posts) {
  const totals = summary.totals || {};
  const totalPosts = Object.values(summary.byPlatform || {}).reduce((a, p) => a + Number(p.posts || 0), 0);
  const totalLikes = Number(totals.likes || 0);
  const totalComments = Number(totals.comments || 0);
  const avgEngagement = totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(1) : "0";

  setText("analyticsTotalPosts", Number(totalPosts).toLocaleString());
  setText("analyticsTotalLikes", totalLikes.toLocaleString());
  setText("analyticsTotalComments", totalComments.toLocaleString());
  setText("analyticsAvgEngagement", avgEngagement);
}

function renderEngagementTrend(posts) {
  const sorted = [...posts].sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
  const labels = sorted.map(p => {
    const d = new Date(p.postedAt);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
  const likes = sorted.map(p => Number(p.likes || 0));
  const comments = sorted.map(p => Number(p.comments || 0));

  destroyChart("engagementTrend");
  const ctx = document.getElementById("chartEngagementTrend");
  if (!ctx) return;
  analyticsCharts.engagementTrend = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: t("chartLikes"), data: likes, borderColor: CHART_COLORS.pink, backgroundColor: CHART_COLORS.pinkLight, fill: true, tension: 0.35, pointRadius: 3 },
        { label: t("chartComments"), data: comments, borderColor: CHART_COLORS.teal, backgroundColor: CHART_COLORS.tealLight, fill: true, tension: 0.35, pointRadius: 3 },
      ],
    },
    options: { ...CHART_DEFAULTS },
  });
}

function renderMediaTypeBreakdown(posts) {
  const buckets = {};
  for (const p of posts) {
    const type = String(p.mediaType || "post").toUpperCase();
    const key = type.includes("REEL") || type === "VIDEO" ? "Reels / Video"
      : type.includes("CAROUSEL") ? "Carousel"
      : type === "IMAGE" ? "Image" : "Other";
    if (!buckets[key]) buckets[key] = { count: 0, likes: 0, comments: 0 };
    buckets[key].count++;
    buckets[key].likes += Number(p.likes || 0);
    buckets[key].comments += Number(p.comments || 0);
  }
  const keys = Object.keys(buckets);
  const avgEng = keys.map(k => {
    const b = buckets[k];
    return b.count > 0 ? +((b.likes + b.comments) / b.count).toFixed(1) : 0;
  });
  const colors = [CHART_COLORS.pink, CHART_COLORS.teal, CHART_COLORS.gold, CHART_COLORS.plum];
  const bgColors = [CHART_COLORS.pinkLight, CHART_COLORS.tealLight, CHART_COLORS.goldLight, CHART_COLORS.plumLight];

  destroyChart("mediaType");
  const ctx = document.getElementById("chartMediaType");
  if (!ctx) return;
  analyticsCharts.mediaType = new Chart(ctx, {
    type: "bar",
    data: {
      labels: keys,
      datasets: [{ label: t("chartAvgEngagement"), data: avgEng, backgroundColor: colors.slice(0, keys.length), borderRadius: 8 }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: { ...CHART_DEFAULTS.scales, x: { ...CHART_DEFAULTS.scales.x, grid: { display: false } } },
    },
  });
}

function renderPostingCadence(posts) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayBuckets = Array.from({ length: 7 }, () => ({ count: 0, engagement: 0 }));
  for (const p of posts) {
    const d = new Date(p.postedAt);
    if (isNaN(d.getTime())) continue;
    const day = d.getDay();
    dayBuckets[day].count++;
    dayBuckets[day].engagement += Number(p.likes || 0) + Number(p.comments || 0);
  }
  const avgByDay = dayBuckets.map(b => b.count > 0 ? +(b.engagement / b.count).toFixed(1) : 0);
  const counts = dayBuckets.map(b => b.count);

  destroyChart("postingCadence");
  const ctx = document.getElementById("chartPostingCadence");
  if (!ctx) return;
  analyticsCharts.postingCadence = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days,
      datasets: [
        { label: t("chartPosts"), data: counts, backgroundColor: CHART_COLORS.roseLight, borderColor: CHART_COLORS.rose, borderWidth: 1, borderRadius: 6, yAxisID: "y" },
        { label: t("chartAvgEngagement"), data: avgByDay, type: "line", borderColor: CHART_COLORS.plum, backgroundColor: "transparent", tension: 0.3, pointRadius: 4, yAxisID: "y1" },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: CHART_DEFAULTS.scales.x,
        y: { ...CHART_DEFAULTS.scales.y, position: "left", title: { display: true, text: t("chartPosts"), font: { family: "Poppins", size: 10 } } },
        y1: { ...CHART_DEFAULTS.scales.y, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: t("chartAvgEngShort"), font: { family: "Poppins", size: 10 } } },
      },
    },
  });
}

function renderCaptionLength(posts) {
  const dataPoints = posts.map(p => ({
    x: String(p.text || "").length,
    y: Number(p.likes || 0) + Number(p.comments || 0),
  }));

  destroyChart("captionLength");
  const ctx = document.getElementById("chartCaptionLength");
  if (!ctx) return;
  analyticsCharts.captionLength = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: t("chartPosts"),
        data: dataPoints,
        backgroundColor: CHART_COLORS.pink,
        borderColor: CHART_COLORS.pinkLight,
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: t("chartCaptionLengthAxis"), font: { family: "Poppins", size: 10 } } },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: t("chartEngagementAxis"), font: { family: "Poppins", size: 10 } } },
      },
    },
  });
}

function renderTopPosts(posts) {
  const sorted = [...posts].sort((a, b) => {
    const engA = Number(a.likes || 0) + Number(a.comments || 0);
    const engB = Number(b.likes || 0) + Number(b.comments || 0);
    return engB - engA;
  }).slice(0, 8);

  const labels = sorted.map((p, i) => {
    const caption = String(p.text || "").trim().slice(0, 30) || `Post ${i + 1}`;
    return caption.length >= 30 ? caption + "…" : caption;
  });
  const likesData = sorted.map(p => Number(p.likes || 0));
  const commentsData = sorted.map(p => Number(p.comments || 0));

  destroyChart("topPosts");
  const ctx = document.getElementById("chartTopPosts");
  if (!ctx) return;
  analyticsCharts.topPosts = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: t("chartLikes"), data: likesData, backgroundColor: CHART_COLORS.pink, borderRadius: 6 },
        { label: t("chartComments"), data: commentsData, backgroundColor: CHART_COLORS.teal, borderRadius: 6 },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: "y",
      plugins: { ...CHART_DEFAULTS.plugins },
      scales: {
        x: { ...CHART_DEFAULTS.scales.y, stacked: true },
        y: { ...CHART_DEFAULTS.scales.x, stacked: true, ticks: { font: { family: "Poppins", size: 10 }, autoSkip: false } },
      },
    },
  });
}

async function loadAnalyticsView() {
  try {
    const [summary, recent] = await Promise.all([
      api("/api/analytics/summary"),
      api("/api/posts/recent?limit=0"),
    ]);
    const posts = recent?.posts || [];
    renderStatCards(summary || {}, posts);
    renderEngagementTrend(posts);
    renderMediaTypeBreakdown(posts);
    renderPostingCadence(posts);
    renderCaptionLength(posts);
    renderTopPosts(posts);
  } catch (err) {
    console.error("Analytics load error:", err);
  }
}

function applyIntegrationUi(platform, integration = {}) {
  const isLinkedin = platform === "linkedin";
  const connected = Boolean(integration.connected);
  const statusId = isLinkedin ? "settingsLinkedinStatus" : "settingsInstagramStatus";
  const button = isLinkedin ? connectLinkedinBtn : connectInstagramBtn;
  const profileId = isLinkedin ? "settingsLinkedinProfile" : "settingsInstagramProfile";
  const handleId = isLinkedin ? "settingsLinkedinHandle" : "settingsInstagramHandle";
  const avatarId = isLinkedin ? "settingsLinkedinAvatar" : "settingsInstagramAvatar";
  const baseName = isLinkedin ? "LinkedIn" : "Instagram";
  const username = String(integration.username || "").trim();
  const avatarUrl = String(integration.avatarUrl || "").trim();

  setText(statusId, connected ? "Connected" : t("notConnected"));
  const statusEl = document.getElementById(statusId);
  if (statusEl) statusEl.classList.toggle("is-connected", connected);

  if (connected && username) {
    setText(profileId, username);
    setText(handleId, `@${username.replace(/^@/, "")}`);
  } else {
    setText(profileId, t("notConnected"));
    setText(handleId, "");
  }

  setAvatar(
    avatarId,
    connected
      ? avatarUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(username || baseName)}&background=f7c6c7&color=7f002d&bold=true&size=96`
      : "",
    `${baseName} profile avatar`,
  );

  if (button) button.classList.toggle("hidden", connected);
}

function applySettingsForm(data) {
  const user = data.user || {};
  const integrations = data.integrations || {};
  const billing = data.payment?.details || {};
  document.getElementById("settingsName").value = user.name || "";
  document.getElementById("settingsEmail").value = user.email || "";
  document.getElementById("settingsNiche").value = user.niche || "";
  document.getElementById("settingsObjective").value = user.objective || "";
  applyIntegrationUi("linkedin", integrations.linkedin || {});
  applyIntegrationUi("instagram", integrations.instagram || {});
  const paid = Boolean(data.payment?.completed);
  const status = paid ? "Active" : "Not active";
  const paidAt = billing.paidAt ? ` (since ${new Date(billing.paidAt).toLocaleDateString()})` : "";
  setText("billingStatusText", `Status: ${status}${paidAt}`);
  if (manageBillingBtn) manageBillingBtn.disabled = !billing.stripeCustomerId;
  if (cancelSubscriptionBtn) cancelSubscriptionBtn.disabled = !billing.stripeSubscriptionId;
}

function setOnboardingMode(mode) {
  const isCreate = mode === "create";
  const isOnboarding = mode === "onboarding";
  const isPayment = mode === "payment";
  setHidden("accountForm", !isCreate);
  setHidden("onboardingForm", !isOnboarding);
  setHidden("paymentForm", !isPayment);
  if (isCreate) {
    document.getElementById("onboardingTitle").textContent = t("onboardingCreateTitle");
    document.getElementById("onboardingSubtitle").textContent = t("onboardingCreateSubtitle");
  } else if (isOnboarding) {
    document.getElementById("onboardingTitle").textContent = t("onboardingFormTitle");
    document.getElementById("onboardingSubtitle").textContent = t("onboardingFormSubtitle");
  } else {
    document.getElementById("onboardingTitle").textContent = t("paymentModeTitle");
    document.getElementById("onboardingSubtitle").textContent = t("paymentModeSubtitle");
  }
}

function paymentCompleted() {
  return Boolean(accountState?.payment?.completed);
}

async function loadAccountState() {
  accountState = await api("/api/account");
  applySettingsForm(accountState);

  if (!accountState.user?.createdAt) {
    showOnboardingModal();
    setOnboardingMode("create");
    return;
  }

  if (!accountState.onboarding?.completed) {
    showOnboardingModal();
    setOnboardingMode("onboarding");
    return;
  }

  if (!paymentCompleted()) {
    showOnboardingModal();
    setOnboardingMode("payment");
    return;
  }

  hideOnboardingModal();
}

async function ensureOnboardingForChat() {
  await loadAccountState();
  if (!accountState?.onboarding?.completed) {
    setOnboardingMode(accountState?.user?.createdAt ? "onboarding" : "create");
    showOnboardingModal();
    return false;
  }
  if (!paymentCompleted()) {
    setOnboardingMode("payment");
    showOnboardingModal();
    return false;
  }
  return true;
}

async function unlockChat(toastMessage) {
  authGate.classList.add("hidden");
  chatApp.classList.remove("hidden");
  if (!signinModal.classList.contains("hidden")) signinModal.classList.add("hidden");
  clearFeedback();
  showToast(toastMessage);
  await loadAccountState();
}

async function handleGoogleAuth(source) {
  clearFeedback();
  window.location.assign(`/auth/google?source=${encodeURIComponent(source)}`);
}

function displayPlatform(platform) {
  if (String(platform || "").toLowerCase() === "linkedin") return "LinkedIn";
  if (String(platform || "").toLowerCase() === "instagram") return "Instagram";
  return "Social";
}

async function connectPlatform(platform) {
  try {
    setText("settingsStatus", tf("integrationRedirecting"));
    const data = await api("/api/integrations/connect", "POST", { platform });
    if (!data.authUrl) {
      throw new Error(t("integrationAuthUrlMissing"));
    }
    window.location.assign(data.authUrl);
  } catch (err) {
    setText("settingsStatus", `${t("integrationConnectFailedPrefix")}: ${err.message}`);
  }
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback();

  const fullName = document.getElementById("signupFullName").value.trim();
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const password = document.getElementById("signupPassword").value;

  if (!fullName || !email || !password) {
    showFeedback(signupFeedback, "Please complete all required fields.");
    return;
  }

  try {
    await api("/api/auth/signup", "POST", { fullName, email, password });
    signupForm.reset();
    await unlockChat(`Welcome to PostPilot, ${fullName}!`);
  } catch (err) {
    showFeedback(signupFeedback, err.message);
  }
});

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFeedback();

  const email = document.getElementById("signinEmail").value.trim().toLowerCase();
  const password = document.getElementById("signinPassword").value;
  try {
    const data = await api("/api/auth/signin", "POST", { email, password });
    signinForm.reset();
    await unlockChat(`Signed in as ${data.user.email}`);
  } catch (err) {
    showFeedback(signinFeedback, err.message);
  }
});

openSignin.addEventListener("click", (event) => {
  event.preventDefault();
  clearFeedback();
  signinModal.classList.remove("hidden");
});

openTrialBtn.addEventListener("click", () => {
  clearFeedback();
  document.getElementById("signupFullName").focus();
});

closeSignin.addEventListener("click", () => {
  signinModal.classList.add("hidden");
});

closeOnboarding.addEventListener("click", () => {
  if (!paymentCompleted()) {
    setText("onboardingError", t("paymentRequiredBeforeContinuing"));
    setOnboardingMode("payment");
    showOnboardingModal();
    return;
  }
  setText("onboardingError", "");
  hideOnboardingModal();
});

disconnectBtn.addEventListener("click", async () => {
  try {
    await api("/api/auth/signout", "POST");
  } catch (_error) {
    // Still clear local UI state even if signout request fails.
  }
  setHidden("settingsModal", true);
  signinModal.classList.add("hidden");
  hideOnboardingModal();
  chatApp.classList.add("hidden");
  authGate.classList.remove("hidden");
  clearFeedback();
  showToast(t("disconnectToast"));
});

signinModal.addEventListener("click", (event) => {
  if (event.target === signinModal) signinModal.classList.add("hidden");
});

onboardingModal.addEventListener("click", (event) => {
  if (event.target === onboardingModal) {
    if (!paymentCompleted()) {
      setText("onboardingError", t("paymentCompleteToContinue"));
      setOnboardingMode("payment");
      showOnboardingModal();
      return;
    }
    setText("onboardingError", "");
    hideOnboardingModal();
  }
});

googleSignupBtn.addEventListener("click", () => handleGoogleAuth("signup"));
googleSigninBtn.addEventListener("click", () => handleGoogleAuth("signin"));
connectLinkedinBtn?.addEventListener("click", () => connectPlatform("linkedin"));
connectInstagramBtn?.addEventListener("click", () => connectPlatform("instagram"));

document.getElementById("composer").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  try {
    const canChat = await ensureOnboardingForChat();
    if (!canChat) {
      addMessage("assistant", t("onboardingRequired"));
      return;
    }

    input.value = "";
    addMessage("user", message);

    const result = await streamChat(message, sessionId);
    if (result.action === "onboarding_required") {
      setOnboardingMode("onboarding");
      showOnboardingModal();
    } else if (result.action === "payment_required") {
      setOnboardingMode("payment");
      showOnboardingModal();
    }
  } catch (err) {
    const msg = String(err.message || "");
    if (/payment required/i.test(msg)) {
      setOnboardingMode("payment");
      showOnboardingModal();
    }
    addMessage("assistant", `Error: ${msg}`);
  }
});

resetChatBtn?.addEventListener("click", () => {
  const messages = document.getElementById("messages");
  messages.innerHTML = "";
  addMessage("assistant", t("newChatStarted"));
});

agentViewBtn?.addEventListener("click", () => {
  setActiveView("agent");
});

analyticsViewBtn?.addEventListener("click", async () => {
  setActiveView("analytics");
  await loadAnalyticsView();
});

document.getElementById("settingsBtn").addEventListener("click", async () => {
  setHidden("settingsModal", false);
  try {
    await loadAccountState();
  } catch (err) {
    setText("settingsStatus", `Could not load settings: ${err.message}`);
  }
});

document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  setHidden("settingsModal", true);
});

document.getElementById("accountForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("accountName").value.trim();
  const email = document.getElementById("accountEmail").value.trim();

  try {
    await api("/api/account/create", "POST", { name, email });
    setText("onboardingError", "");
    setOnboardingMode("onboarding");
  } catch (err) {
    const msg = String(err.message || "");
    if (/route not found/i.test(msg)) {
      setText("onboardingError", t("paymentEndpointUnavailable"));
      return;
    }
    setText("onboardingError", msg);
  }
});

document.getElementById("onboardingForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const niche = document.getElementById("onboardNiche").value.trim();
  const objective = document.getElementById("onboardObjective").value.trim();

  if (!niche || !objective) {
    setText("onboardingError", t("onboardingMissingFields"));
    return;
  }

  try {
    await api("/api/account/onboarding/complete", "POST", {
      niche,
      objective,
    });
    setText("onboardingError", "");
    setOnboardingMode("payment");
    showOnboardingModal();
    await loadAccountState();
    addMessage("assistant", t("onboardingDone"));
  } catch (err) {
    setText("onboardingError", err.message);
  }
});

document.getElementById("paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const confirmed = document.getElementById("paymentConfirm").checked;
  if (!confirmed) {
    setText("onboardingError", t("paymentConfirmTerms"));
    return;
  }
  try {
    const data = await api("/api/payment/create-checkout-session", "POST", { plan: "monthly" });
    if (!data.checkoutUrl) {
      throw new Error(t("paymentCheckoutSessionError"));
    }
    window.location.assign(data.checkoutUrl);
  } catch (err) {
    setText("onboardingError", err.message);
  }
});

document.getElementById("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("settingsName").value.trim(),
    email: document.getElementById("settingsEmail").value.trim(),
    niche: document.getElementById("settingsNiche").value.trim(),
    objective: document.getElementById("settingsObjective").value.trim(),
    linkedinUsername: accountState?.integrations?.linkedin?.username || "",
    instagramUsername: accountState?.integrations?.instagram?.username || "",
  };
  try {
    const data = await api("/api/settings/save", "POST", payload);
    accountState = data;
    applySettingsForm(data);
    addMessage("assistant", t("settingsSaved"));
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
});

manageBillingBtn?.addEventListener("click", async () => {
  try {
    setText("settingsStatus", "Opening billing portal...");
    const data = await api("/api/payment/create-portal-session", "POST");
    window.location.assign(data.url);
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
});

cancelSubscriptionBtn?.addEventListener("click", async () => {
  const ok = window.confirm("Cancel your subscription at period end?");
  if (!ok) return;
  try {
    setText("settingsStatus", "Updating subscription...");
    await api("/api/payment/cancel-subscription", "POST");
    setText("settingsStatus", "Subscription set to cancel at period end.");
    await loadAccountState();
  } catch (err) {
    setText("settingsStatus", `Error: ${err.message}`);
  }
});

for (const tabButton of document.querySelectorAll(".settings-nav-btn")) {
  tabButton.addEventListener("click", () => {
    const tab = tabButton.getAttribute("data-tab");
    for (const btn of document.querySelectorAll(".settings-nav-btn")) {
      btn.classList.toggle("active", btn === tabButton);
    }
    for (const panel of document.querySelectorAll(".settings-panel")) {
      panel.classList.toggle("active", panel.getAttribute("data-panel") === tab);
    }
  });
}

function buildSuggestionsPopup() {
  const popup = document.getElementById("suggestionsPopup");
  if (!popup) return;
  popup.innerHTML = "";
  const suggestions = t("suggestions");
  if (!Array.isArray(suggestions)) return;
  for (const s of suggestions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion-item";
    if (s.icon) {
      const ico = document.createElement("span");
      ico.className = "suggestion-item-icon";
      ico.textContent = s.icon;
      btn.appendChild(ico);
    }
    const label = document.createElement("span");
    label.className = "suggestion-item-label";
    label.textContent = s.label;
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      const input = document.getElementById("messageInput");
      if (input) { input.value = s.prompt; input.focus(); }
      popup.classList.add("hidden");
    });
    popup.appendChild(btn);
  }
}

const suggestionsBtn = document.getElementById("suggestionsBtn");
const suggestionsPopup = document.getElementById("suggestionsPopup");

if (suggestionsBtn && suggestionsPopup) {
  suggestionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    suggestionsPopup.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!suggestionsPopup.contains(e.target) && e.target !== suggestionsBtn) {
      suggestionsPopup.classList.add("hidden");
    }
  });
}

addMessage(
  "assistant",
  t("initialAssistant")
);
applyLanguage();
setActiveView("agent");

const authQueryState = getAuthQueryState();
let handledFreshGoogleAuth = false;
if (authQueryState.authError) {
  const target = authQueryState.source === "signin" ? signinFeedback : signupFeedback;
  showFeedback(
    target,
    authQueryState.authDetail
      ? `Google sign-in failed (${authQueryState.authError}: ${authQueryState.authDetail}).`
      : `Google sign-in failed (${authQueryState.authError}).`,
  );
  clearAuthQueryParams();
}

if (authQueryState.checkout === "cancel") {
  showFeedback(signupFeedback, t("checkoutCanceled"));
  clearAuthQueryParams();
}

if (authQueryState.checkout === "success") {
  showToast(t("checkoutProcessing"));
  clearAuthQueryParams();
}

if (authQueryState.integrationAuth === "success" && authQueryState.integration) {
  const platformLabel = displayPlatform(authQueryState.integration);
  showToast(tf("integrationConnectedToast", { platform: platformLabel }));
  clearAuthQueryParams();
}

if (authQueryState.integrationError && authQueryState.integration) {
  const platformLabel = displayPlatform(authQueryState.integration);
  const errorDetail = authQueryState.integrationDetail
    ? `${authQueryState.integrationError}: ${authQueryState.integrationDetail}`
    : authQueryState.integrationError;
  showToast(tf("integrationConnectErrorToast", { platform: platformLabel, error: errorDetail }));
  clearAuthQueryParams();
}

if (authQueryState.googleAuth === "success") {
  handledFreshGoogleAuth = true;
  unlockChat(t("googleConnected")).catch((err) => {
    const target = authQueryState.source === "signin" ? signinFeedback : signupFeedback;
    showFeedback(target, `Could not finish Google sign-in: ${err.message}`);
  });
  clearAuthQueryParams();
}

if (!handledFreshGoogleAuth) {
  api("/api/auth/session")
    .then((session) => {
      if (session.authenticated) {
        unlockChat(`Welcome back, ${session.user.fullName}.`).catch((err) => {
          showFeedback(signupFeedback, `Could not restore session: ${err.message}`);
        });
      }
    })
    .catch(() => {});
}
