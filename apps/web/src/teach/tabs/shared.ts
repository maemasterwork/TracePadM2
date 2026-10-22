import type { AllLabs } from '../../learn/hooks';
import type { TeachApi } from '../api';
import type { ClassRow, Student } from '../types';

export interface TabProps {
  api: TeachApi; cls: ClassRow; roster: Student[]; all: AllLabs; isOwner: boolean; userId: string;
  reloadClass: () => void; reloadRoster: () => void;
}
export const studentName = (s: Student) => s.full_name || s.username || s.id.slice(0, 8);
