/** @typedef {{ id: string, view: 'front' | 'back', path: string }} BodyMapRegion */

function r(x, y, w, h) {
  return `M${x},${y} h${w} v${h} h${-w} Z`;
}

/** 50 named regions per AIS sprint taxonomy (28 front, 22 back). */
export const BODY_MAP_REGIONS = /** @type {BodyMapRegion[]} */ ([
  // Front — head to feet
  { id: 'Right Head', view: 'front', path: r(52, 4, 16, 14) },
  { id: 'Left Head', view: 'front', path: r(32, 4, 16, 14) },
  { id: 'Right Shoulder', view: 'front', path: r(58, 20, 18, 12) },
  { id: 'Left Shoulder', view: 'front', path: r(24, 20, 18, 12) },
  { id: 'Right Chest', view: 'front', path: r(52, 34, 16, 16) },
  { id: 'Left Chest', view: 'front', path: r(32, 34, 16, 16) },
  { id: 'Right Upper Arm', view: 'front', path: r(72, 32, 12, 28) },
  { id: 'Left Upper Arm', view: 'front', path: r(16, 32, 12, 28) },
  { id: 'Right Elbow', view: 'front', path: r(74, 60, 10, 10) },
  { id: 'Left Elbow', view: 'front', path: r(16, 60, 10, 10) },
  { id: 'Right Abdomen', view: 'front', path: r(52, 52, 16, 18) },
  { id: 'Left Abdomen', view: 'front', path: r(32, 52, 16, 18) },
  { id: 'Right Forearm', view: 'front', path: r(76, 70, 10, 24) },
  { id: 'Left Forearm', view: 'front', path: r(14, 70, 10, 24) },
  { id: 'Right Wrist', view: 'front', path: r(78, 94, 8, 8) },
  { id: 'Left Wrist', view: 'front', path: r(14, 94, 8, 8) },
  { id: 'Right Hip and Groin', view: 'front', path: r(50, 72, 18, 16) },
  { id: 'Left Hip and Groin', view: 'front', path: r(32, 72, 18, 16) },
  { id: 'Right Thigh', view: 'front', path: r(52, 90, 14, 34) },
  { id: 'Left Thigh', view: 'front', path: r(34, 90, 14, 34) },
  { id: 'Right Knee', view: 'front', path: r(52, 124, 14, 12) },
  { id: 'Left Knee', view: 'front', path: r(34, 124, 14, 12) },
  { id: 'Right Lower Leg', view: 'front', path: r(54, 136, 12, 32) },
  { id: 'Left Lower Leg', view: 'front', path: r(34, 136, 12, 32) },
  { id: 'Right Ankle', view: 'front', path: r(54, 168, 12, 8) },
  { id: 'Left Ankle', view: 'front', path: r(34, 168, 12, 8) },
  { id: 'Right Foot', view: 'front', path: r(52, 176, 16, 10) },
  { id: 'Left Foot', view: 'front', path: r(32, 176, 16, 10) },

  // Back
  { id: 'Right Posterior Head', view: 'back', path: r(52, 4, 16, 14) },
  { id: 'Left Posterior Head', view: 'back', path: r(32, 4, 16, 14) },
  { id: 'Right Neck', view: 'back', path: r(52, 18, 14, 10) },
  { id: 'Left Neck', view: 'back', path: r(34, 18, 14, 10) },
  { id: 'Right Posterior Shoulder', view: 'back', path: r(58, 28, 18, 12) },
  { id: 'Left Posterior Shoulder', view: 'back', path: r(24, 28, 18, 12) },
  { id: 'Right Thoracic Spine', view: 'back', path: r(52, 40, 14, 20) },
  { id: 'Left Thoracic Spine', view: 'back', path: r(34, 40, 14, 20) },
  { id: 'Right Posterior Trunk', view: 'back', path: r(52, 62, 16, 18) },
  { id: 'Left Posterior Trunk', view: 'back', path: r(32, 62, 16, 18) },
  { id: 'Right Buttock and Pelvis', view: 'back', path: r(50, 82, 18, 16) },
  { id: 'Left Buttock and Pelvis', view: 'back', path: r(32, 82, 18, 16) },
  { id: 'Right Posterior Elbow', view: 'back', path: r(74, 58, 10, 10) },
  { id: 'Left Posterior Elbow', view: 'back', path: r(16, 58, 10, 10) },
  { id: 'Right Posterior Hand', view: 'back', path: r(76, 88, 10, 12) },
  { id: 'Left Posterior Hand', view: 'back', path: r(14, 88, 10, 12) },
  { id: 'Right Posterior Knee', view: 'back', path: r(52, 124, 14, 12) },
  { id: 'Left Posterior Knee', view: 'back', path: r(34, 124, 14, 12) },
  { id: 'Right Posterior Ankle', view: 'back', path: r(54, 168, 12, 8) },
  { id: 'Left Posterior Ankle', view: 'back', path: r(34, 168, 12, 8) },
  { id: 'Right Posterior Foot', view: 'back', path: r(52, 176, 16, 10) },
  { id: 'Left Posterior Foot', view: 'back', path: r(32, 176, 16, 10) },
]);

export const FRONT_BODY_OUTLINE =
  'M50,2 C62,2 70,12 70,22 V28 C78,30 84,38 84,50 V96 C84,104 78,108 78,112 V168 C78,178 70,186 60,186 H40 C30,186 22,178 22,168 V112 C22,108 16,104 16,96 V50 C16,38 22,30 30,28 V22 C30,12 38,2 50,2 Z';

export const BACK_BODY_OUTLINE =
  'M50,2 C62,2 70,12 70,22 V28 C78,30 84,38 84,50 V96 C84,104 78,108 78,112 V168 C78,178 70,186 60,186 H40 C30,186 22,178 22,168 V112 C22,108 16,104 16,96 V50 C16,38 22,30 30,28 V22 C30,12 38,2 50,2 Z';

export function getRegionsForView(view) {
  return BODY_MAP_REGIONS.filter((region) => region.view === view);
}
