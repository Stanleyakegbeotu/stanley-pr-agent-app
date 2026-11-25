// GENERATED from the STANLEY desktop app (src/data/serviceGuide/other.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/** Service guide — endoscopy, heart, brain, DNA and examinations. */
import type { GuideEntry } from './types';
import { entry as e } from './types';

export const OTHER: GuideEntry[] = [
  // PHARYNGOSCOPY (owner: scope procedures sit under this category)
  e(['PHARYNGOSCOPY'], 'pharyngoscopy', 'A camera examination of the throat and voice box.', 'Investigates hoarseness, throat pain, difficulty swallowing and lumps in the throat.', ['throat', 'hoarseness', 'voice', 'swallowing', 'scope']),
  e(['ESOPHAGOSCOPY'], 'upperEndoscopy', 'A camera examination of the gullet (oesophagus).', 'Investigates difficulty swallowing, reflux and bleeding.', ['swallowing', 'reflux', 'oesophagus', 'heartburn']),
  e(['GASTROSCOPY'], 'upperEndoscopy', 'A camera examination of the gullet, stomach and first part of the bowel.', 'Investigates ulcers, persistent indigestion, vomiting blood and anaemia.', ['stomach', 'ulcer', 'indigestion', 'vomiting blood', 'endoscopy']),
  e(['COLONOSCOPY'], 'colonoscopy', 'A camera examination of the whole large bowel.', 'Investigates bleeding from the back passage, bowel habit change, anaemia and screens for bowel cancer.', ['colon', 'blood in stool', 'bowel cancer', 'bowel habit', 'colonoscopy']),

  // DNA (owner-added category)
  e(['FATHER AND CHILD'], 'dna', 'A DNA relationship (paternity) test between an alleged father and one child.', 'Confirms whether a man is the biological father of a child.', ['paternity', 'dna', 'father', 'relationship test']),
  e(['EXTRA CHILD'], 'dna', 'Adds one more child to a paternity test.', 'Tests an additional child against the same alleged father.', ['paternity', 'dna', 'second child']),

  // Heart
  e(['ECG'], 'ecg', 'Electrocardiogram — a recording of the heart’s electrical activity.', 'Checks heart rhythm and signs of heart attack or strain — for chest pain, palpitations, high blood pressure and pre-surgery checks.', ['ecg', 'ekg', 'heart', 'palpitations', 'chest pain', 'heart rhythm']),
  e(['24 HOURS HOLTER ECG'], 'holter', 'A 24-hour ECG recording with a small portable recorder.', 'Catches irregular heartbeats that come and go — palpitations, dizziness or fainting.', ['holter', 'palpitations', 'irregular heartbeat', 'fainting', 'dizziness']),
  e(['ECHOCARDIOGRAPHY (ADULT)'], 'echo', 'An ultrasound scan of the heart (adults).', 'Shows the heart’s pumping strength, valves and walls — for breathlessness, murmurs, heart failure and high blood pressure.', ['echo', 'heart', 'heart failure', 'murmur', 'breathlessness']),
  e(['ECHOCARDIOGRAPHY (CHILDREN)'], 'echo', 'An ultrasound scan of the heart for babies and children.', 'Checks for heart defects (holes in the heart) and murmurs in children.', ['echo', 'child heart', 'hole in heart', 'murmur']),
  e(['CONSULTATION'], 'consultation', 'A consultation with the cardiologist (heart specialist).', 'Assessment of heart symptoms and a treatment plan.', ['cardiologist', 'heart specialist', 'consultation']),

  // Brain
  e(['EEG'], 'eeg', 'Electroencephalogram — a recording of the brain’s electrical activity.', 'Investigates seizures/epilepsy, fainting spells and some sleep or behaviour problems.', ['eeg', 'seizure', 'epilepsy', 'convulsion', 'fits']),

  // Examination
  e(['MEDICAL EXAMINATION'], 'medical', 'A general medical examination by a doctor.', 'For employment, school, travel or fitness certificates and general health checks.', ['medical', 'fitness', 'employment', 'checkup', 'certificate']),
];
