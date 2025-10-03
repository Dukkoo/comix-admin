// utils/subscription.ts

export interface SubscriptionInfo {
  isActive: boolean;
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
  endDate: Date | null;
  isExpired: boolean;
}

export function calculateSubscriptionInfo(subscriptionEndDate: string | null): SubscriptionInfo {
  if (!subscriptionEndDate) {
    return {
      isActive: false,
      daysLeft: 0,
      hoursLeft: 0,
      minutesLeft: 0,
      endDate: null,
      isExpired: false,
    };
  }

  const endDate = new Date(subscriptionEndDate);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();

  if (diffTime <= 0) {
    return {
      isActive: false,
      daysLeft: 0,
      hoursLeft: 0,
      minutesLeft: 0,
      endDate: endDate,
      isExpired: true,
    };
  }

  const daysLeft = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

  return {
    isActive: true,
    daysLeft,
    hoursLeft,
    minutesLeft,
    endDate: endDate,
    isExpired: false,
  };
}

export function addDaysToCurrentTime(days: number): Date {
  const result = new Date();
  result.setDate(result.getDate() + days);
  return result;
}

export function formatSubscriptionEndDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long", 
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getSubscriptionStatusColor(daysLeft: number): string {
  if (daysLeft === 0) return "text-red-400";
  if (daysLeft === 1) return "text-orange-400"; 
  if (daysLeft <= 7) return "text-yellow-400";
  return "text-emerald-400";
}

export function isSubscriptionExpiring(daysLeft: number): boolean {
  return daysLeft <= 7 && daysLeft > 0;
}