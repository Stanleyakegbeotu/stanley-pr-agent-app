/**
 * Every image the app uses, bundled with the app (offline-first).
 * Credits and licences: ./CREDITS.md.
 */
import agentAvatar from './photos/agent-avatar.jpg';
import mriThumb from './photos/mri-thumb.jpg';
import mriHero from './photos/mri-hero.jpg';
import ctThumb from './photos/ct-thumb.jpg';
import ctHero from './photos/ct-hero.jpg';
import xrayThumb from './photos/xray-thumb.jpg';
import xrayHero from './photos/xray-hero.jpg';
import ultrasoundThumb from './photos/ultrasound-thumb.jpg';
import ultrasoundHero from './photos/ultrasound-hero.jpg';
import labThumb from './photos/lab-thumb.jpg';
import labHero from './photos/lab-hero.jpg';
import bloodThumb from './photos/blood-thumb.jpg';
import bloodHero from './photos/blood-hero.jpg';

import womanHealthWorker from './stickers/woman-health-worker.png';
import manHealthWorker from './stickers/man-health-worker.png';
import healthWorker from './stickers/health-worker.png';
import moneyBag from './stickers/money-bag.png';
import gift from './stickers/gift.png';
import target from './stickers/target.png';
import megaphone from './stickers/megaphone.png';
import clipboard from './stickers/clipboard.png';
import chart from './stickers/chart.png';
import coin from './stickers/coin.png';
import testTube from './stickers/test-tube.png';
import microscope from './stickers/microscope.png';
import party from './stickers/party.png';
import sparkles from './stickers/sparkles.png';
import trophy from './stickers/trophy.png';
import books from './stickers/books.png';
import speech from './stickers/speech.png';
import calendar from './stickers/calendar.png';
import hospital from './stickers/hospital.png';
import check from './stickers/check.png';
import bell from './stickers/bell.png';
import rocket from './stickers/rocket.png';
import stethoscope from './stickers/stethoscope.png';
import xray from './stickers/xray.png';
import envelope from './stickers/envelope.png';

export const PHOTOS = {
  agentAvatar,
  mri: { thumb: mriThumb, hero: mriHero },
  ct: { thumb: ctThumb, hero: ctHero },
  xray: { thumb: xrayThumb, hero: xrayHero },
  ultrasound: { thumb: ultrasoundThumb, hero: ultrasoundHero },
  lab: { thumb: labThumb, hero: labHero },
  blood: { thumb: bloodThumb, hero: bloodHero },
};
export type PhotoKey = Exclude<keyof typeof PHOTOS, 'agentAvatar'>;

export const STICKERS = {
  womanHealthWorker,
  manHealthWorker,
  healthWorker,
  moneyBag,
  gift,
  target,
  megaphone,
  clipboard,
  chart,
  coin,
  testTube,
  microscope,
  party,
  sparkles,
  trophy,
  books,
  speech,
  calendar,
  hospital,
  check,
  bell,
  rocket,
  stethoscope,
  xray,
  envelope,
};
export type StickerKey = keyof typeof STICKERS;
