// Mifflin-St Jeor Equation
export function calcBMR(gender: string, age: number, height: number, weight: number): number {
  const base = 10 * weight + 6.25 * height - 5 * age
  return gender === 'male' ? base + 5 : base - 161
}
