import contributions from '@/data/contributions.json';
import type {ContributionData} from '@/lib/types';

/**
 * The committed build input. scripts/fetch-contributions.mjs is the only writer.
 * Single import point so the emptiness check below cannot drift from what renders.
 */
export const contributionData = contributions as ContributionData;

/**
 * False while `days` is empty, which is the state of a fresh checkout before the first
 * successful refresh. The contributions section and its nav entry both key off this.
 */
export const hasContributions = contributionData.days.length > 0;
