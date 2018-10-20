// @ts-ignore
const chai = require("chai");
const chaiAsPromised = require('chai-as-promised');
const sinonChai = require('sinon-chai');
const deepEqualInAnyOrder = require('deep-equal-in-any-order');

chai.use(chaiAsPromised);
chai.use(sinonChai);
chai.use(deepEqualInAnyOrder);

