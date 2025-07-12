export const sendResponse = (
    res,
    statusCode,
    message,
    data,
    meta
) => {
    if (statusCode === 204) {
        return res.status(204).send();
    }
    return res.status(statusCode).json({
        status: statusCode >= 400 ? "error" : "success",
        statusCode,
        message,
        ...(data && { data }), // Include data only if it exists
        ...(meta && { meta }), // Include meta only if it exists
    });
};