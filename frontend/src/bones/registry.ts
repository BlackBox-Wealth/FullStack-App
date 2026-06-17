import { configureBoneyard, registerBones } from 'boneyard-js/react';

configureBoneyard({
  animate: 'shimmer',
  color: '#e9ecef',
  darkColor: '#2b2f36',
  shimmerColor: '#f3f5f7',
  darkShimmerColor: '#3b4048',
  speed: '1.9s',
  shimmerAngle: 110,
});

// This file is intentionally scaffolded. Running `npx boneyard-js build`
// will generate and register real bones.
registerBones({});
