class AuthenticationManager {
    constructor() {
        this._authentications = {};
    }

    /**
     *
     * @param {String} domainName
     * @return {boolean}
     */
    hasAuthFor(domainName) {
        return Object.keys(this._authentications).length && domainName in this._authentications;
    }

    /**
     *
     * @param {String} domainName
     * @return {AuthenticationBasic|AuthenticationX509}
     */
    getAuthFor(domainName) {
        return this._authentications[domainName];
    }

    /**
     * Set basic auth configuration for the specified domain name
     * @param domainName
     * @param username
     * @param password
     */
    setBasicAuth(domainName, username, password) {
        this._authentications[domainName] = new AuthenticationBasic(domainName, username, password);
    }

    /**
     * Set cert auth configuration for the specified domain name
     * @param domainName
     * @param certificatePath
     * @param certificatePassphrase
     */
    setX509Auth(domainName, certificatePath, certificatePassphrase) {
        this._authentications[domainName] = new AuthenticationX509(domainName, certificatePath, certificatePassphrase);
    }
}

class Authentication {
    constructor(type, domainName) {
        this._type = type;
        this._domainName = domainName;
    }

    /**
     *
     * @return {String}
     */
    type() {
        return this._type;
    }

    /**
     * Which domain name the authentication data belongs to
     * @return {String}
     */
    domainName() {
        return this._domainName;
    }
}

class AuthenticationBasic extends Authentication {
    constructor(domainName, username, password) {
        super(Authentication.Types.Basic, domainName);
        this._username = username;
        this._password = password;
    }

    username() {
        return this._username;
    }

    password() {
        return this._password;
    }
}

class AuthenticationX509 extends Authentication {
    constructor(domainName, certFilePath, certPassphrase) {
        super(Authentication.Types.X509, domainName);
        this._certFilePath = certFilePath;
        this._certPassphrase = certPassphrase;
    }

    certFilePath() {
        return this._certFilePath;
    }

    certPassPhrase() {
        return this._certPassphrase;
    }
}

Authentication.Types = {
    Basic: "basic",
    X509: "x509"
};

module.exports = {
    AuthenticationManager,
    Authentication,
    AuthenticationBasic,
    AuthenticationX509
};
