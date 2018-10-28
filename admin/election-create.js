'use strict';

const utils = require("../lib/utils")
const async = require("../lib/async")
const Joi = require('joi');

const createElectionSchema = Joi.object().keys({
  autoActivate: Joi.boolean().default(false),
  continuousReveal: Joi.boolean().default(false),
  metadataLocation: Joi.string().required(),
  requireProof: Joi.boolean().default(true),
  netvoteKeyAuth: Joi.boolean().default(false),
  allowUpdates: Joi.boolean().default(false),
  closeAfter: Joi.date().default(new Date().getTime()),
  voteStartTime: Joi.date().default(new Date().getTime()),
  test: Joi.boolean().default(false),
  voteEndTime: Joi.date().default(0),
  network: Joi.string().only("netvote", "ropsten", "mainnet").required()
})

module.exports.create = async (event, context) => {

  try {

    let params = await utils.validate(event.body, createElectionSchema);
    let user = utils.getUser(event);

    if(params.network === "mainnet"){
      if(!user.mainnet){
        return utils.error(403, "user does not have permission to use mainnet")
      }
    }

    if(params.voteEndTime && params.voteEndTime < (new Date().getTime())){
      return utils.error(400, "voteEndTime is in the past.  Value should be in epoch milliseconds.")
    }

    let payload = {
      network: params.network,
      election: {
          type: "basic",
          allowUpdates: params.allowUpdates,
          isPublic: params.continuousReveal,
          requireProof: params.requireProof,
          closeAfter: params.closeAfter,
          netvoteKeyAuth: params.netvoteKeyAuth,
          metadataLocation: params.metadataLocation,
          autoActivate: params.autoActivate,
          voteStartTime: params.voteStartTime,
          voteEndTime: params.voteEndTime,
          isDemo: false, 
          test: params.test,
          uid: user.id
      }
    }

    let jobId = await async.startJob("election-create", payload, user);
    return utils.sendJobId(jobId)

  } catch (e) {
    return utils.error(400, e.message)
  }

};
