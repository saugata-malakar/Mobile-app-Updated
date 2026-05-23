import type {WoundSiteRecord} from '../types/patientDashboard';

export type WoundZoneOption = {
  id: string;
  label: string;
  side: 'L' | 'R';
  zone: WoundSiteRecord['zone'];
  foot_side: 'LEFT' | 'RIGHT';
  location_on_foot: 'HALLUX' | 'FOREFOOT' | 'MIDFOOT' | 'HEEL';
};

export const WOUND_ZONES: WoundZoneOption[] = [
  {id: 'L-heel', label: 'Left heel', side: 'L', zone: 'heel', foot_side: 'LEFT', location_on_foot: 'HEEL'},
  {id: 'L-fore', label: 'Left forefoot', side: 'L', zone: 'forefoot', foot_side: 'LEFT', location_on_foot: 'FOREFOOT'},
  {id: 'L-mid', label: 'Left midfoot', side: 'L', zone: 'midfoot', foot_side: 'LEFT', location_on_foot: 'MIDFOOT'},
  {id: 'L-ankle', label: 'Left ankle', side: 'L', zone: 'ankle', foot_side: 'LEFT', location_on_foot: 'FOREFOOT'},
  {id: 'L-dorsum', label: 'Left dorsum', side: 'L', zone: 'dorsum', foot_side: 'LEFT', location_on_foot: 'FOREFOOT'},
  {id: 'L-toe1', label: 'Left great toe', side: 'L', zone: 'toe1', foot_side: 'LEFT', location_on_foot: 'HALLUX'},
  {id: 'R-heel', label: 'Right heel', side: 'R', zone: 'heel', foot_side: 'RIGHT', location_on_foot: 'HEEL'},
  {id: 'R-fore', label: 'Right forefoot', side: 'R', zone: 'forefoot', foot_side: 'RIGHT', location_on_foot: 'FOREFOOT'},
  {id: 'R-mid', label: 'Right midfoot', side: 'R', zone: 'midfoot', foot_side: 'RIGHT', location_on_foot: 'MIDFOOT'},
  {id: 'R-ankle', label: 'Right ankle', side: 'R', zone: 'ankle', foot_side: 'RIGHT', location_on_foot: 'FOREFOOT'},
  {id: 'R-dorsum', label: 'Right dorsum', side: 'R', zone: 'dorsum', foot_side: 'RIGHT', location_on_foot: 'FOREFOOT'},
  {id: 'R-toe1', label: 'Right great toe', side: 'R', zone: 'toe1', foot_side: 'RIGHT', location_on_foot: 'HALLUX'},
];
