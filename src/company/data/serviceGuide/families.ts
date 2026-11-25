// GENERATED from the STANLEY desktop app (src/data/serviceGuide/families.ts). Do not edit here: change the desktop file and run scripts/sync-company.mjs.
/**
 * Service guide — how each KIND of test is done (owner, 2026-11-23).
 *
 * Every catalogue service belongs to a family (blood test, urine test, X-ray,
 * MRI, ultrasound, CT, endoscopy, ECG…). The family gives the step-by-step
 * procedure, the preparation, the sample and the usual time; each service's
 * own entry (lab.ts, imaging.ts, other.ts) adds what the test is, what doctors
 * use it for, words people use for it, and any preparation of its own.
 *
 * Written from standard patient-information references (MedlinePlus, NHS,
 * RadiologyInfo.org, Lab Tests Online / testing.com). General guidance for
 * PR agents and staff — the branch and the requesting doctor confirm the
 * details for each patient.
 */

export type Family =
  | 'blood'
  | 'bloodFasting'
  | 'fingerPrick'
  | 'urine'
  | 'urine24'
  | 'stool'
  | 'swab'
  | 'genitalSwab'
  | 'semen'
  | 'sputum'
  | 'csf'
  | 'breath'
  | 'tissue'
  | 'fnac'
  | 'cervical'
  | 'xray'
  | 'xrayBarium'
  | 'xrayContrast'
  | 'hsg'
  | 'mammogram'
  | 'mri'
  | 'ultrasound'
  | 'ultrasoundFasting'
  | 'ultrasoundBladder'
  | 'ultrasoundTransvaginal'
  | 'ultrasoundTransrectal'
  | 'ultrasoundInfant'
  | 'doppler'
  | 'ct'
  | 'ctContrast'
  | 'colonoscopy'
  | 'upperEndoscopy'
  | 'pharyngoscopy'
  | 'ecg'
  | 'holter'
  | 'echo'
  | 'eeg'
  | 'dna'
  | 'medical'
  | 'consultation'
  | 'record';

export interface FamilyGuide {
  /** What is collected or done ("Blood sample", "X-ray images"). */
  sample: string;
  /** Step by step, from arrival to leaving. */
  procedure: string[];
  /** What the patient should do before coming. */
  preparation: string;
  /** Usual time at the branch for the test itself. */
  duration: string;
}

const ARRIVE = 'At the branch the patient gives their referral ID at the front desk and pays.';

export const FAMILIES: Record<Family, FamilyGuide> = {
  blood: {
    sample: 'Blood sample',
    procedure: [ARRIVE, 'A trained phlebotomist cleans the inside of the elbow and draws a small amount of blood from a vein with a sterile needle.', 'A plaster is put on the spot; the patient can go home or back to work straight away.'],
    preparation: 'No special preparation. The patient should take usual medicines unless the doctor says otherwise.',
    duration: 'About 5–10 minutes',
  },
  bloodFasting: {
    sample: 'Blood sample (fasting)',
    procedure: [ARRIVE, 'The lab confirms the patient has fasted.', 'A small amount of blood is drawn from a vein in the arm with a sterile needle.', 'A plaster is put on the spot; the patient can eat and drink straight after.'],
    preparation: 'Fast for 8–12 hours before the test — no food or drinks except plain water. Coming early in the morning makes fasting easier.',
    duration: 'About 5–10 minutes',
  },
  fingerPrick: {
    sample: 'Blood drop (finger prick) or blood sample',
    procedure: [ARRIVE, 'The fingertip is cleaned and pricked with a small sterile lancet (or blood is drawn from the arm).', 'A drop of blood is collected and tested.'],
    preparation: 'No special preparation.',
    duration: 'About 5 minutes',
  },
  urine: {
    sample: 'Urine sample',
    procedure: [ARRIVE, 'The patient is given a sterile container and shown to a private toilet.', 'After cleaning the genital area, the patient passes the first bit of urine into the toilet, then collects the middle part of the stream ("midstream") in the container.', 'The closed container is handed to the lab.'],
    preparation: 'If possible, give the first urine of the morning. Women should tell staff if they are on their period.',
    duration: 'About 5–10 minutes',
  },
  urine24: {
    sample: '24-hour urine collection',
    procedure: ['The patient collects a large container from the branch.', 'On day 1 the first morning urine is passed into the toilet; every drop of urine after that, for 24 hours, goes into the container (kept cool).', 'The next morning the first urine is added and the container is brought back to the branch.'],
    preparation: 'Collect the container first and follow the written instructions exactly — missing any urine affects the result.',
    duration: '24 hours of collection at home; a few minutes to drop it off',
  },
  stool: {
    sample: 'Stool (faeces) sample',
    procedure: [ARRIVE, 'The patient is given a clean container with a small scoop.', 'A small amount of stool is collected (not mixed with urine or water) and the container is closed.', 'The sample is handed to the lab — ideally within 1–2 hours of collection.'],
    preparation: 'Collect the container from the branch first. Tell the lab about any antibiotics or diarrhoea medicine being taken.',
    duration: 'A few minutes to hand in',
  },
  swab: {
    sample: 'Swab',
    procedure: [ARRIVE, 'A health worker gently rubs a sterile cotton swab over the area (throat, ear, wound or skin).', 'The swab goes into a sealed tube and is sent to the lab to grow and identify any germs.'],
    preparation: 'If possible, come before starting antibiotics. For a throat swab, don’t eat or drink for 30 minutes before.',
    duration: 'About 5 minutes',
  },
  genitalSwab: {
    sample: 'Genital swab',
    procedure: [ARRIVE, 'The test is done in a private room, with a chaperone if the patient wishes.', 'For women a speculum is gently inserted and a soft swab is taken from the vagina or cervix; for men a thin swab is taken from the opening of the urethra.', 'The swab goes into a sealed tube for the lab.'],
    preparation: 'Avoid sex, douching and vaginal creams for 24–48 hours before. Not during a heavy period. Men should not urinate for about 1 hour before a urethral swab.',
    duration: 'About 5–10 minutes',
  },
  semen: {
    sample: 'Semen sample',
    procedure: ['The patient is given a sterile container.', 'The sample is produced by masturbation into the container in a private room at the branch (or at home, if the lab allows).', 'A home sample must reach the lab within 1 hour, kept at body temperature (e.g. in an inside pocket).'],
    preparation: 'No ejaculation for 2–5 days before the test (but not more than 7). Avoid alcohol for a few days. Do not use lubricants or condoms to collect the sample.',
    duration: 'About 15–30 minutes',
  },
  sputum: {
    sample: 'Sputum (phlegm) sample',
    procedure: ['Early in the morning the patient rinses the mouth with plain water (no toothpaste).', 'The patient takes a few deep breaths and coughs deeply to bring up phlegm from the chest — not saliva — into a sterile container.', 'The container is closed and brought to the lab. Some tests need samples on 3 days in a row.'],
    preparation: 'Collect the container from the branch first. The early-morning sample is the best one.',
    duration: 'A few minutes',
  },
  csf: {
    sample: 'Cerebrospinal fluid (CSF)',
    procedure: ['The fluid is collected by a doctor in hospital through a lumbar puncture (a thin needle in the lower back under local anaesthetic).', 'The sample is brought to the lab quickly for testing.'],
    preparation: 'Arranged by the patient’s doctor or hospital — the branch receives and tests the sample.',
    duration: 'Lab test only',
  },
  breath: {
    sample: 'Breath samples',
    procedure: [ARRIVE, 'The patient breathes into a small bag or tube to give a first breath sample.', 'The patient drinks a special solution, then waits about 15–30 minutes.', 'A second breath sample is taken and the two are compared.'],
    preparation: 'Fast for at least 6 hours. Stop antibiotics 4 weeks and stomach-acid medicines (e.g. omeprazole) 2 weeks before, if the doctor agrees.',
    duration: 'About 30–45 minutes',
  },
  tissue: {
    sample: 'Tissue sample (biopsy)',
    procedure: ['A doctor removes a small piece of tissue during a biopsy or surgery.', 'The tissue is placed in a preservative and sent to the lab.', 'Thin slices are prepared and examined under the microscope by a pathologist.'],
    preparation: 'The sample is taken by the patient’s doctor; the patient usually does not need to come to the branch for this test.',
    duration: 'Lab test only',
  },
  fnac: {
    sample: 'Cells drawn from a lump',
    procedure: [ARRIVE, 'The skin over the lump is cleaned.', 'A very thin needle is passed into the lump and a few cells are drawn into a syringe (sometimes guided by ultrasound).', 'Light pressure is applied and a small plaster put on; the cells are examined under the microscope.'],
    preparation: 'Usually no preparation. Tell staff about blood-thinning medicines.',
    duration: 'About 15–30 minutes',
  },
  cervical: {
    sample: 'Cells from the cervix',
    procedure: [ARRIVE, 'In a private room the patient lies on a couch; a speculum is gently inserted into the vagina.', 'A small soft brush is used to collect cells from the cervix (neck of the womb).', 'The cells are sent to the lab. It may be slightly uncomfortable but is quick.'],
    preparation: 'Best done mid-cycle, not during a period. Avoid sex, douching and vaginal creams for 48 hours before.',
    duration: 'About 10 minutes',
  },
  xray: {
    sample: 'X-ray images',
    procedure: [ARRIVE, 'The patient removes jewellery and metal items and may change into a gown.', 'The radiographer positions the body part between the X-ray machine and the detector — often from two angles (front and side).', 'The patient keeps very still (and may hold the breath) for a few seconds while each picture is taken. It is painless.'],
    preparation: 'No special preparation. Remove metal items around the area. Tell staff if the patient is or may be pregnant.',
    duration: 'About 10–15 minutes',
  },
  xrayBarium: {
    sample: 'X-ray images with barium contrast',
    procedure: [ARRIVE, 'The patient changes into a gown.', 'The patient drinks (or, for an enema, is given through the back passage) a white barium liquid that shows up on X-ray.', 'The radiologist takes moving and still X-ray pictures as the barium passes through, sometimes asking the patient to turn on the table.', 'Afterwards the patient drinks plenty of water; stools may be pale for a day or two.'],
    preparation: 'Usually no food or drink for 6 hours before. A barium enema needs bowel preparation (laxatives) the day before — the branch gives the instructions.',
    duration: 'About 30–60 minutes (follow-through can take a few hours)',
  },
  xrayContrast: {
    sample: 'X-ray images with contrast dye',
    procedure: [ARRIVE, 'The patient changes into a gown and lies on the X-ray table.', 'A contrast dye is gently put into the area being studied (through a thin tube or catheter).', 'X-ray pictures are taken as the dye fills the area; the tube is then removed.'],
    preparation: 'The branch gives specific instructions when booking. Tell staff about allergies to contrast dye and about pregnancy.',
    duration: 'About 30–45 minutes',
  },
  hsg: {
    sample: 'X-ray of the womb and tubes with contrast dye',
    procedure: [ARRIVE, 'The patient lies on the X-ray table as for a smear test; a speculum is inserted.', 'A thin tube is passed through the cervix and a contrast dye is gently put into the womb.', 'X-ray pictures show the dye filling the womb and flowing through the fallopian tubes. Cramping like period pain is common for a short time.'],
    preparation: 'Booked between day 7 and day 10 of the cycle (after the period ends, before ovulation). Avoid unprotected sex from the period until the test. A painkiller 30–60 minutes before can help.',
    duration: 'About 30 minutes',
  },
  mammogram: {
    sample: 'X-ray images of the breasts',
    procedure: [ARRIVE, 'The patient undresses to the waist in private.', 'Each breast in turn is placed on the machine and gently pressed between two plates for a few seconds while the picture is taken — usually two views of each breast.', 'It can be uncomfortable for a few seconds but is quick.'],
    preparation: 'Do not use deodorant, talcum powder or lotion under the arms or on the breasts on the day. Best done the week after a period, when breasts are less tender.',
    duration: 'About 15–20 minutes',
  },
  mri: {
    sample: 'MRI images',
    procedure: [ARRIVE, 'The patient completes a safety checklist and removes all metal (jewellery, watch, hairpins, phone, cards) and changes into a gown.', 'The patient lies on a table that slides into the tunnel-shaped scanner; the part being scanned is placed in a padded coil.', 'The scanner makes loud knocking sounds — earplugs or headphones are given. The patient must keep very still; the radiographer talks through an intercom.', 'Some scans need a contrast injection into a vein half-way through.'],
    preparation: 'Remove all metal. Tell staff before booking about a pacemaker, metal implants, clips, shrapnel, pregnancy, kidney problems or fear of closed spaces. Some abdominal scans need 4–6 hours of fasting.',
    duration: 'About 30–60 minutes',
  },
  ultrasound: {
    sample: 'Ultrasound images',
    procedure: [ARRIVE, 'The patient lies on a couch and uncovers the area being scanned.', 'A cool gel is put on the skin and a small handheld probe is moved over it; sound waves make live pictures on a screen.', 'It is painless and uses no radiation. The gel is wiped off afterwards.'],
    preparation: 'No special preparation. Wear loose, comfortable clothing.',
    duration: 'About 15–30 minutes',
  },
  ultrasoundFasting: {
    sample: 'Ultrasound images',
    procedure: [ARRIVE, 'The patient lies on a couch and uncovers the tummy.', 'A cool gel is put on the skin and a small probe is moved over the abdomen to see the organs on a screen.', 'It is painless and uses no radiation.'],
    preparation: 'No food for 6–8 hours before (plain water is fine), so the gallbladder and organs show clearly. For the pelvic part, drink 4–6 glasses of water an hour before and don’t empty the bladder.',
    duration: 'About 20–30 minutes',
  },
  ultrasoundBladder: {
    sample: 'Ultrasound images',
    procedure: [ARRIVE, 'The patient lies on a couch and uncovers the lower tummy.', 'Gel is put on the skin and a small probe is moved over the lower abdomen; a full bladder helps the organs behind it show clearly.', 'It is painless and uses no radiation. The patient can empty the bladder afterwards.'],
    preparation: 'Come with a full bladder: drink 4–6 glasses (about 1 litre) of water an hour before and do not urinate until after the scan.',
    duration: 'About 15–30 minutes',
  },
  ultrasoundTransvaginal: {
    sample: 'Internal ultrasound images',
    procedure: [ARRIVE, 'In a private room (a chaperone can be present) the patient empties the bladder and lies on the couch.', 'A slim probe with a protective cover and gel is gently placed a little way into the vagina; it gives clearer pictures of the womb and ovaries.', 'It may feel like pressure but should not hurt.'],
    preparation: 'Empty the bladder just before the scan. It can be done during a period.',
    duration: 'About 15–20 minutes',
  },
  ultrasoundTransrectal: {
    sample: 'Internal ultrasound images',
    procedure: [ARRIVE, 'In a private room the patient lies on the left side with knees bent.', 'A lubricated probe, about the width of a finger, is gently placed into the back passage to view the prostate.', 'It may feel like pressure; it takes only a few minutes.'],
    preparation: 'An enema or bowel emptying may be asked for before the scan; the branch gives instructions. A partly full bladder may be needed.',
    duration: 'About 15–20 minutes',
  },
  ultrasoundInfant: {
    sample: 'Ultrasound images of a baby’s brain',
    procedure: [ARRIVE, 'The baby lies on the couch or a parent’s lap.', 'Gel is put on the soft spot (fontanelle) on top of the head and a small probe is moved gently over it to see the brain.', 'It is painless and uses no radiation.'],
    preparation: 'Feed the baby shortly before so they are calm or asleep. Only possible while the soft spot is still open (usually under 12–18 months).',
    duration: 'About 15–20 minutes',
  },
  doppler: {
    sample: 'Doppler ultrasound (blood flow)',
    procedure: [ARRIVE, 'The patient lies on a couch and uncovers the area (legs, neck, abdomen or other).', 'Gel is put on the skin and the probe is moved along the blood vessels; the machine shows and sounds the blood flow.', 'It is painless and uses no radiation.'],
    preparation: 'No special preparation. Wear loose clothing.',
    duration: 'About 30–60 minutes',
  },
  ct: {
    sample: 'CT images',
    procedure: [ARRIVE, 'The patient removes metal items and may change into a gown.', 'The patient lies on a table that moves slowly through a large ring-shaped scanner.', 'The patient keeps still and follows breathing instructions; the scan itself takes only a few minutes and is painless.'],
    preparation: 'Remove metal items. Tell staff if the patient is or may be pregnant.',
    duration: 'About 10–20 minutes',
  },
  ctContrast: {
    sample: 'CT images with contrast',
    procedure: [ARRIVE, 'Staff check kidney function and allergies; a small cannula is placed in an arm vein. For abdominal scans the patient may drink a contrast liquid first.', 'The patient lies on a table that moves through a ring-shaped scanner; contrast dye is injected — it can cause a warm feeling or a metallic taste for a moment.', 'After the scan the patient waits a short time and drinks plenty of water to flush the dye out.'],
    preparation: 'No food for 4–6 hours before (water is fine). Tell staff about allergies to contrast or iodine, kidney disease, diabetes medicine (metformin) and pregnancy. A recent kidney test (E/U/C) may be requested.',
    duration: 'About 30–60 minutes including preparation',
  },
  colonoscopy: {
    sample: 'Camera examination of the large bowel',
    procedure: [ARRIVE, 'The patient changes into a gown; a sedative may be given to relax them.', 'Lying on the left side, a thin flexible tube with a camera is passed through the back passage to look at the whole large bowel.', 'Small samples (biopsies) or polyps may be removed painlessly. The patient rests until the sedation wears off.'],
    preparation: 'The bowel must be empty: a low-fibre diet for 2 days, clear fluids only the day before and a bowel-cleansing laxative as instructed by the branch. If sedated, someone must accompany the patient home.',
    duration: 'About 30–60 minutes, plus recovery time',
  },
  upperEndoscopy: {
    sample: 'Camera examination of the gullet and stomach',
    procedure: [ARRIVE, 'The throat is numbed with a spray and/or a sedative is given.', 'A mouth guard is placed and a thin flexible tube with a camera is passed through the mouth into the gullet, stomach and first part of the bowel.', 'Small samples can be taken painlessly. The patient rests briefly afterwards and should not eat until the throat feels normal.'],
    preparation: 'No food for 6–8 hours and no drinks for 2–4 hours before. If sedated, someone must accompany the patient home.',
    duration: 'About 10–20 minutes, plus recovery time',
  },
  pharyngoscopy: {
    sample: 'Camera examination of the throat',
    procedure: [ARRIVE, 'The nose and throat may be numbed with a spray.', 'A thin, flexible camera is passed gently through the nose (or a mirror/scope through the mouth) to look at the throat and voice box.', 'The patient may be asked to speak or swallow during the test.'],
    preparation: 'Usually avoid eating for 2 hours before; the branch confirms.',
    duration: 'About 10–15 minutes',
  },
  ecg: {
    sample: 'Heart tracing',
    procedure: [ARRIVE, 'The patient lies down and uncovers the chest, wrists and ankles.', 'Small sticky pads (electrodes) are placed on the chest, arms and legs and connected to the ECG machine.', 'The patient lies still and breathes normally for a few minutes while the heart’s electrical activity is recorded. It is painless.'],
    preparation: 'Avoid body lotion or oil on the chest on the day. Wear a top that is easy to remove. Bring a list of medicines.',
    duration: 'About 5–10 minutes',
  },
  holter: {
    sample: '24-hour heart recording',
    procedure: [ARRIVE, 'Sticky pads are placed on the chest and connected to a small recorder worn on a belt or strap.', 'The patient goes home and carries on with normal daily life for 24 hours, writing down any symptoms and the time they happen.', 'The patient returns the next day to have the recorder removed; the recording is analysed.'],
    preparation: 'Have a bath or shower before coming — the recorder must not get wet. Wear loose clothing. Avoid electric blankets and keep phones a little away from the recorder.',
    duration: 'About 15 minutes to fit, then 24 hours at home',
  },
  echo: {
    sample: 'Ultrasound of the heart',
    procedure: [ARRIVE, 'The patient undresses to the waist and lies on the left side on a couch.', 'ECG stickers may be put on the chest; gel is applied and a probe is moved over the chest to see the heart beating, its valves and blood flow.', 'It is painless and uses no radiation.'],
    preparation: 'No special preparation. Children should be calm — bring a favourite toy or feed a baby just before.',
    duration: 'About 30–45 minutes',
  },
  eeg: {
    sample: 'Brainwave recording',
    procedure: [ARRIVE, 'Small metal discs (electrodes) are attached to the scalp with a sticky paste or cap.', 'The patient rests quietly with eyes closed; they may be asked to breathe deeply and look at flashing lights.', 'Brain activity is recorded on a computer. It is painless; the paste washes out of the hair.'],
    preparation: 'Wash hair the night before — no oils, gels or hair cream. Continue usual medicines unless the doctor says otherwise. Some EEGs need the patient to sleep less the night before — the branch will say.',
    duration: 'About 45–60 minutes',
  },
  dna: {
    sample: 'Cheek swab (DNA)',
    procedure: [ARRIVE, 'Everyone being tested brings photo ID (birth certificate or photo for children); identities are recorded and photographs taken for the chain of custody.', 'A soft swab is rubbed inside each person’s cheek for a few seconds.', 'The swabs are sealed in front of the participants and sent to the DNA laboratory.'],
    preparation: 'Do not eat, drink or smoke for 30 minutes before. A parent or legal guardian must consent for children under 18.',
    duration: 'About 20–30 minutes',
  },
  medical: {
    sample: 'Medical examination',
    procedure: [ARRIVE, 'The patient answers questions about their health and medical history.', 'Height, weight, blood pressure, pulse and vision are checked, and a doctor examines the patient.', 'Some examinations include basic tests (blood, urine, chest X-ray) depending on the purpose; a report is issued.'],
    preparation: 'Bring valid ID, any form required by the employer, school or embassy, and previous results. Fasting may be needed if blood tests are included.',
    duration: 'About 30–60 minutes',
  },
  consultation: {
    sample: 'Specialist consultation',
    procedure: [ARRIVE, 'The specialist asks about symptoms and medical history and examines the patient.', 'Tests such as ECG or echocardiography may be done or requested.', 'The doctor explains the findings and the treatment plan.'],
    preparation: 'Bring previous results, the referral letter and all current medicines.',
    duration: 'About 20–40 minutes',
  },
  record: {
    sample: 'Copy of images',
    procedure: ['The patient (or doctor) asks the branch for a copy of their images.', 'The images are copied onto a CD or other media.'],
    preparation: 'Bring the receipt or details of the earlier scan.',
    duration: 'A few minutes',
  },
};
