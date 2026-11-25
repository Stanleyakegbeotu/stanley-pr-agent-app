import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import { Root } from './app/Root';
import { Gate } from './app/Gate';
import { watchSafeArea } from './app/safeArea';
import { initSecureStore } from './domain/secureStore';
import { migrateLegacyChat } from './domain/chat';
import { migrateLegacyVoice } from './domain/referralVoice';

watchSafeArea();

// Patient data is decrypted into memory before the first screen (and any
// plain-text data from earlier versions is encrypted and the original removed).
void (async () => {
  await initSecureStore().catch(() => undefined);
  await Promise.all([migrateLegacyChat(), migrateLegacyVoice()]).catch(() => undefined);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Gate>
        <Root />
      </Gate>
    </React.StrictMode>,
  );
})();
