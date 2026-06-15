export function descriptorDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.sqrt(
    a.reduce((total, value, index) => {
      const diff = value - b[index];
      return total + diff * diff;
    }, 0),
  );
}

export function findBestFaceMatch(queryDescriptor, people, threshold = 0.6) {
  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const person of people) {
    const distance = descriptorDistance(queryDescriptor, person.faceProfile?.descriptor);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = person;
    }
  }

  if (!bestMatch || bestDistance > threshold) {
    return null;
  }

  return {
    person: bestMatch,
    distance: bestDistance,
    confidence: Math.max(0, Math.min(1, 1 - bestDistance)),
  };
}
