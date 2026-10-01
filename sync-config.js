// Configuração da sincronização do Painel acadêmico.
//
// FIREBASE_CONFIG: o mesmo projeto do sistema de leads (leads-unifecaf). Login por e-mail e senha;
// quem acessa é definido pelas regras do Firestore (administradora + função Permanência na Equipe).
//
// FIREBASE_CONFIG_ANTIGO: o banco antigo do painel (polo-1740). Usado uma única vez, para copiar os
// dados para o banco novo no primeiro acesso. Depois da cópia, pode ser removido.
//
// Essas chaves não são secretas; quem protege os dados são as regras de segurança do banco.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyB1CJdk19P4zWobK18F3MMnbDoccVWBNHM",
  authDomain: "leads-unifecaf.firebaseapp.com",
  projectId: "leads-unifecaf",
  storageBucket: "leads-unifecaf.firebasestorage.app",
  messagingSenderId: "618199075796",
  appId: "1:618199075796:web:ddbbeb681c30c80545a441"
};
window.FIREBASE_CONFIG_ANTIGO = {
  apiKey: "AIzaSyDK23BDQ0RJ41sosvFnQ7_c1MY9PEHv6u4",
  authDomain: "polo-1740.firebaseapp.com",
  projectId: "polo-1740",
  storageBucket: "polo-1740.firebasestorage.app",
  messagingSenderId: "793828338382",
  appId: "1:793828338382:web:ab14cf4bc5dd0b64353e9f"
};
// Link do sistema de leads e alunos (aparece no menu do painel).
window.LINK_SISTEMA_LEADS = "https://isabelladutras.github.io/leadsunifecaf/";
