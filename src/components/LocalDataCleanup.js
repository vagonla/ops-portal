'use client';

import { useEffect } from 'react';
import { clearRetiredData } from '@/lib/retiredData';

export default function LocalDataCleanup() {
  useEffect(() => { clearRetiredData(); }, []);
  return null;
}
