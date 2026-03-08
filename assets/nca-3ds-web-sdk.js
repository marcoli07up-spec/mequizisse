/**
 * Returns the EMVCo-specified  window sizes depending on the challengeWindowSize value.
 *
 * @param challengeWindowSize - EMVCo-specified window size
 * @returns {string[]} - window size
 */
const getWindowSize = (challengeWindowSize = '05') => {
    switch (challengeWindowSize) {
        case '01':
            return ['250px', '400px'];
        case '02':
            return ['390px', '400px'];
        case '03':
            return ['500px', '600px'];
        case '04':
            return ['600px', '400px'];
        case '05':
            return ['100%', '100%'];
        default:
            throw Error(`Selected window size ${challengeWindowSize} is not supported`);
    }
};
/**
 * Creates a form element with one input field and sets the input value.
 *
 * @param formName - the name of the form element
 * @param formAction - the endpoint where the form will be submitted
 * @param formTarget - the iFrame name where the form will be appended to
 * @param inputName - the name of the field
 * @param inputValue - the value of the field
 * @throws {Error} - throws an error if there is a validation error
 * @returns {HTMLFormElement} - the generated form element
 */
const createForm = (formName, formAction, formTarget, inputName, inputValue) => {

    if (!formName || !formAction || !formTarget || !inputName || !inputValue) {
        throw Error('All fields must be present');
    }

    const form = document.createElement('form');
    form.name = formName;
    form.action = formAction;
    form.method = 'POST';
    form.target = formTarget;
    form.enctype = "application/x-www-form-urlencoded";

    const input = document.createElement('input');
    input.name = inputName;
    input.value = inputValue;
    form.appendChild(input);
    form.style.display = 'none';
    return form;
};
/**
 * Creates an iframe component and attaches it to the provided container.
 *
 * @param container - HTML element to attach the iframe
 * @param name - name of the iframe container. It will be used when attaching the form element
 * @param id - id of the iframe container
 * @param width - width of the container. Default is 0.
 * @param height - height of the container. Default is 0.
 * @param onLoadCallback - callback that will be executed when the frame loads. This is optional
 * @returns {HTMLIFrameElement} generated iframe
 */
const createIFrame = (container, name, id, width = '0', height = '0', onLoadCallback) => {
    if (!container || !name || !id) {
        throw Error('Not all required fields have value');
    }
    if (!(container instanceof HTMLElement)) {
        throw Error('Container must be a HTML element');
    }

    const iframe = document.createElement('iframe');
    iframe.width = width;
    iframe.height = height;
    iframe.name = name;
    iframe.setAttribute('id', id);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('border', '0');
    iframe.setAttribute('style', 'overflow:hidden; position:absolute');
    iframe.setAttribute('allowfullscreen', 'false');
    iframe.setAttribute('allowpaymentrequest', 'false');
    iframe.setAttribute('allow', 'payment; publickey-credentials-get');
    iframe.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin')

    if (onLoadCallback && typeof onLoadCallback === 'function') {
        if (iframe.attachEvent) {
            iframe.attachEvent('onload', onLoadCallback);
        } else {
            iframe.onload = onLoadCallback;
        }
    }

    container.appendChild(iframe);

    return iframe;
};

const init3DSMethod = (threeDSMethodUrl, threeDSMethodData, container) => {

    if (!threeDSMethodUrl || !threeDSMethodData || !container) {
        throw Error('Not all fields have value');
    }
    if (!(container instanceof HTMLIFrameElement)) {
        throw Error('Container is not an iFrame element');
    }
    if (!container.name) {
        throw Error('Container must have a name attribute');
    }

    const html = document.createElement('html');
    const body = document.createElement('body');
    const form = createForm('threeDSMethodForm', threeDSMethodUrl, container.name, "threeDSMethodData", threeDSMethodData);

    body.appendChild(form);
    html.appendChild(body);
    container.appendChild(html);
    container.style.display = 'none';

    form.submit();

    return container;
};

const init3DSChallengeRequest = (acsUrl, creqData, container) => {
    if (!acsUrl || !creqData || !container) {
        throw Error('Not all required fields have value');
    }
    if (!(container instanceof HTMLIFrameElement)) {
        throw Error('Container is not of type iframe');
    }
    if (!container.name) {
        throw Error('Container must have a name attribute');
    }

    const html = document.createElement('html');
    const body = document.createElement('body');
    const form = createForm('challengeRequestForm', acsUrl, container.name, "creq", creqData);

    body.appendChild(form);
    html.appendChild(body);
    container.appendChild(html);


    form.submit();

    return container;

};

const createIframeAndInit3DSMethod = (threeDSMethodUrl, threeDSMethodData, frameName = 'threeDSMethodIFrame',
                                      rootContainer = document.body, onFrameLoadCallback) => {
    const iFrame = createIFrame(rootContainer, frameName, 'threeDSMethodIframe', '0', '0', onFrameLoadCallback);
    iFrame.style.visibility = 'hidden';
    init3DSMethod(threeDSMethodUrl, threeDSMethodData, iFrame);
    return iFrame;
};

const createIFrameAndInit3DSChallengeRequest = (acsUrl, creqData, challengeWindowSize = '05',
                                                frameName = "threeDSCReqIFrame", rootContainer = document.body, onFrameLoadCallback) => {
    const windowSize = getWindowSize(challengeWindowSize);
    const iFrame = createIFrame(rootContainer, frameName, 'threeDSCReqIframe', windowSize[0], windowSize[1], onFrameLoadCallback);
    iFrame.sandbox.add('allow-pointer-lock');
    init3DSChallengeRequest(acsUrl, creqData, iFrame);
    return iFrame;
};

const initiateSPCAuthentication = async function (spcData, webAuthnCredList) {
    return await initiatePayment(spcData, webAuthnCredList, spcData.currency);
};

const initiateSPCAuthenticationWithProvidedPurchaseCurrency = async function (spcData, webAuthnCredList, purchaseCurrency) {
    return await initiatePayment(spcData, webAuthnCredList, purchaseCurrency);
};

const initiatePayment = async function (spcData, webAuthnCredList, purchaseCurrency) {
    const paymentRequest = createPaymentRequest(spcData, webAuthnCredList, purchaseCurrency);

    try {
        const instrumentResponse = await paymentRequest.show();
        const encodedSPCCredential = base64EncodeSPCCredential(instrumentResponse.details);
        await instrumentResponse.complete('success');
        return JSON.stringify(encodedSPCCredential);
    } catch (err) {
        console.log(err);
        return null;
    }
};

const isBrowserSPCAuthenticationSupported = async () => {
    if (!window.PaymentRequest) {
        return [false, 'Payment Request API is not supported'];
    }

    try {
        const supportedInstruments = [
            {
                supportedMethods: 'secure-payment-confirmation',
                data: {
                    rpId: 'rp.example',
                    credentialIds: [new Uint8Array(1)],
                    challenge: new Uint8Array(1),
                    instrument: {
                        displayName: ' ',
                        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgA' +
                            'FhAJ/wlseKgAAAABJRU5ErkJggg==',
                    },
                    payeeOrigin: 'https://non-existent.example',
                }
            }
        ];

        const details = {
            total: {label: 'Total', amount: {currency: 'USD', value: '0'}},
        };

        const request = new PaymentRequest(supportedInstruments, details);
        const canMakePayment = await request.canMakePayment();
        return [canMakePayment, canMakePayment ? '' : 'SPC is not available'];
    } catch (error) {
        console.error(error);
        return [false, error.message];
    }
};

const createPaymentRequest = function(spcData, webAuthnCredList, purchaseCurrency) {
    const supportedInstruments = [
        {
            supportedMethods: 'secure-payment-confirmation',
            data: {
                credentialIds: decodeBase64UrlCredentials(webAuthnCredList),
                challenge: decodeBase64Url(spcData.challenge),
                timeout: spcData.timeout,
                payeeOrigin: spcData.payeeOrigin,
                rpId: webAuthnCredList[0].rpID,
                instrument: {
                    displayName: spcData.displayName,
                    icon: spcData.icon,
                },
            },
        }
    ];

    const details = {
        total: {
            label: 'Total amount: ',
            amount: {
                currency: purchaseCurrency,
                value: spcData.value,
            },
        },
    };
    return new PaymentRequest(supportedInstruments, details);
};

const decodeBase64UrlCredentials = function (webAuthnCredList) {
    let credentials = [];
    webAuthnCredList.forEach(element => credentials.push(decodeBase64Url(element.credentialIds)));
    return credentials;
};

const decodeBase64Url = function (input) {
    try {
        return decodeBase64(input.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''));
    } catch (_a) {
        throw new TypeError('The input to be decoded is not correctly encoded.');
    }
};

const decodeBase64 = function (encoded) {
    return new Uint8Array(atob(encoded)
        .split('')
        .map((c) => c.charCodeAt(0)));
};

const base64EncodeSPCCredential = function (credential) {
    const encResponse = {};
    const response = credential.response;
    encResponse.authenticatorData = byteArrayToBase64(response.authenticatorData);
    encResponse.clientDataJSON = byteArrayToBase64(response.clientDataJSON);
    encResponse.signature = byteArrayToBase64(response.signature);
    encResponse.userHandle = byteArrayToBase64(response.userHandle);

    const encCredential = {};
    encCredential.response = encResponse;
    encCredential.rawId = byteArrayToBase64(credential.rawId);
    encCredential.authenticatorAttachment = credential.authenticatorAttachment;
    encCredential.type = credential.type;
    encCredential.clientExtensionResults = credential.getClientExtensionResults();

    return encCredential
};

const byteArrayToBase64 = function (byteArray) {
    return btoa(Array.from(new Uint8Array(byteArray)).map(val => {
        return String.fromCharCode(val);
    }).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '');
}

// START SNIPPET: PublicPart
/**
 * Attach all methods to window.
 */
let nca3DSWebSDK = {};
/**
 * Creates an iframe, attach it to the rootContainer and submit 3DS Method form.
 *
 * @param threeDSMethodUrl - a FQDN endpoint to submit the 3DS Method request
 * @param threeDSMethodData - Base64-encoded 3DS Method Data value
 * @param frameName - name of the frame container. if not set it will be set to 'threeDSMethodIFrame'
 * @param rootContainer - the container where the iframe will be attached to.
 *                        If not set defaults to the JavaScript document.body object
 * @param onFrameLoadCallback - callback function attached to the iframe.onload event
 * @throws {Error} - throws error if there is a validation error
 * @returns {HTMLIFrameElement} - returns the generated iframe element
 */
nca3DSWebSDK.createIframeAndInit3DSMethod = createIframeAndInit3DSMethod;
/**
 * Initiates a 3DS Method request and submits the form the 3DS Method URL. It will automatically hide the container
 * when initiating a 3DS Method request.
 *
 * @param threeDSMethodUrl - a FQDN endpoint to submit the 3DS Method request
 * @param threeDSMethodData - Base64-encoded 3DS Method Data value.
 * @param container - the iframe container where the form will be attached to. The container must have the 'name'
 *                    attribute set
 * @throws {Error} - throws error if there is a validation error
 * @returns {HTMLIFrameElement} - the container
 */
nca3DSWebSDK.init3DSMethod = init3DSMethod;
/**
 * Initiates a 3DS Challenge request and submits the form the ACS URL.
 *
 * @param acsUrl - the FQDN URL to submit the Challenge Request
 * @param creqData - Base64-encoded Challenge Request
 * @param container - the iframe container where the form will be attached to. The container must have the 'name'
 *                    attribute set
 * @throws {Error} - throws error if there is a validation error
 * @returns {HTMLIFrameElement} - the container
 */
nca3DSWebSDK.init3DSChallengeRequest = init3DSChallengeRequest;
/**
 * Creates an iframe, attach it to the rootContainer and submits 3DS Challenge Request.
 * @param acsUrl - the FQDN URL to submit the Challenge Request
 * @param creqData - Base64-encoded Challenge Request
 * @param challengeWindowSize - EMVCo assigned window size.
 *                              '01' -> 250px x 400px,
 *                              '02' -> 390px x 400px,
 *                              '03' -> 500px x 600px,
 *                              '04' -> 600px x 400px,
 *                              '05' -> Full screen, or full container content
 * @param frameName - name of the frame container. if not set it will be set to 'threeDSCReqIFrame'
 * @param rootContainer - the container where the iframe will be attached to.
 *                        If not set defaults to the JavaScript document.body object
 * @param onFrameLoadCallback - callback function attached to the iframe.onload event
 * @throws {Error} - throws error if there is a validation error
 * @returns {HTMLIFrameElement} - returns the generated iframe element
 */
nca3DSWebSDK.createIFrameAndInit3DSChallengeRequest = createIFrameAndInit3DSChallengeRequest;
/**
 * Initiates SPC authentication by utilizing the Payment Request API. This method should be used when
 * ARes protocol message is in EMVCo format 2.3.1.1 as the 'spcTransData.currency' field has been changed to the ISO 4217 alphabetic code.
 * @param spcData - the Authentication response 'spcTransData' field
 * @param webAuthnCredList - the Authentication response 'webAuthnCredList' field
 *
 * @type function performing the initiation of the SPC data signing
 */
nca3DSWebSDK.initiateSPCAuthentication = initiateSPCAuthentication;
/**
 * Initiates SPC authentication by utilizing the Payment Request API. This method should be used when
 * ARes protocol message is in EMVCo format <= 2.3.1.
 * @param spcData - the Authentication response 'spcTransData' field
 * @param webAuthnCredList - the Authentication response 'webAuthnCredList' field
 * @param purchaseCurrency - the alphabetical code of the currency by ISO 4217
 *
 * @type function performing the initiation of the SPC data signing
 */
nca3DSWebSDK.initiateSPCAuthenticationWithProvidedPurchaseCurrency = initiateSPCAuthenticationWithProvidedPurchaseCurrency;
/**
 * Checks if the current browser environment supports SPC (Secure Payment Confirmation) authentication.
 *
 * @async
 * @returns {Promise<Array>} A promise that resolves to an array containing the result of the check.
 *                           The first element of the array is a boolean indicating whether SPC authentication is supported.
 *                           The second element is a string providing additional information if SPC authentication is not supported.
 */
nca3DSWebSDK.isBrowserSPCAuthenticationSupported = isBrowserSPCAuthenticationSupported;

window.nca3DSWebSDK = nca3DSWebSDK;
// END SNIPPET: PublicPart