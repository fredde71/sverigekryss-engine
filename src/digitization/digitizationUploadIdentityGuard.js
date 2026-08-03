export async function runDigitizationUploadWithIdentity({
  uploadId,
  isCurrentUpload,
  runProduction,
  runComparison,
  onPending,
  onProductionCompleted,
  onProductionFailed,
  onComparisonCompleted,
  onComparisonFailed
}) {
  if (!isCurrentUpload(uploadId)) {
    return;
  }

  onPending();

  let productionResult;

  try {
    productionResult = await runProduction();
  } catch (error) {
    if (isCurrentUpload(uploadId)) {
      onProductionFailed(error);
    }
    return;
  }

  if (!isCurrentUpload(uploadId)) {
    return;
  }

  onProductionCompleted(productionResult);

  if (!runComparison) {
    return;
  }

  try {
    const comparisonResult = await runComparison(productionResult);

    if (isCurrentUpload(uploadId)) {
      onComparisonCompleted(comparisonResult);
    }
  } catch (error) {
    if (isCurrentUpload(uploadId)) {
      onComparisonFailed(error);
    }
  }
}
