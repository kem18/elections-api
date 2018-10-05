const assert = require('assert');
const VOTES = require("./vote-examples").VOTES;
const netvoteApis = require("../sdk")


const nv = netvoteApis.initAdminClient(process.env.NETVOTE_DEV_API_ID, process.env.NETVOTE_DEV_API_SECRET)
const publicNv = netvoteApis.initVoterClient()

const assertElectionState = async (electionId, state) => {
    await assertElectionValues(electionId, {electionStatus: state})
}

const assertElectionValues = async (electionId, keyVals) => {
    let el = await publicNv.GetElection(electionId);
    Object.keys(keyVals).forEach((name) => {
        let expected = keyVals[name];
        assert.equal(el[name], expected, `expected ${name} == ${expected}, but was ${el[name]}`);
    })
}

describe(`End to End Election`, function() {

    let electionId;
    let voterKeys;
    let tokens = [];

    it('should create election', async () => {
        let job = await nv.CreateElection({
            autoActivate: false,
            continuousReveal: false,
            metadataLocation: "QmZaKMumAXXLkHPBV1ZdAVsF4XCUYz1Jp5PY3oEsLrKoy6",
            allowUpdates: true,
            netvoteKeyAuth: true,
            network: "netvote"
        });

        assert.equal(job.jobId != null, true, "jobId should be present: "+JSON.stringify(job))
        assert.equal(job.txStatus, "pending", "status should be pending")

        // confirm initial job state
        let checkJob = await nv.AdminGetJob(job.jobId);
        assert.equal(checkJob.txStatus, "pending", "should be in pending state")

        // give it one minute to complete
        let finished = await nv.PollJob(job.jobId, 60000);

        assert.equal(finished.txStatus, "complete", "should be in complete state")
        assert.equal(finished.txResult.address != null, true, "address should be set")
        assert.equal(finished.txResult.electionId != null, true, "electionId should be set")
        assert.equal(finished.txResult.tx != null, true, "tx should be set")

        electionId = finished.txResult.electionId;
        console.log(`electionId: ${electionId}`)
        await assertElectionState(electionId, "building")
    })

    it('should generate keys', async ()=> {
        let res = await nv.AddVoterKeys(electionId, {generate: 5});
        assert.equal(res.keys != null, true, "should have keys populated")
        assert.equal(res.keys.length, 5, "should have generated 5 keys");
        voterKeys = res.keys;
    })

    it('should add a key', async ()=> {
        let res = await nv.AddVoterKeys(electionId, {keys: ["test1","test2","test3"]});
        assert.equal(res.count, 3, "should have a count of 3")
    })

    it('should activate election', async () => {
        let job = await nv.SetElectionStatus(electionId, {
            status: "voting"
        });
        assert.equal(job.jobId != null, true, "jobId should be present: "+JSON.stringify(job))


        // confirm initial job state
        let checkJob = await nv.AdminGetJob(job.jobId);
        assert.equal(checkJob.txStatus, "pending", "should be in pending state")

        // give it one minute to complete
        let finished = await nv.PollJob(job.jobId, 60000);

        assert.equal(finished.txStatus, "complete", "should be in complete state")

        await assertElectionState(electionId, "voting")
    })

    it('should stop election', async () => {
        let job = await nv.SetElectionStatus(electionId, {
            status: "stopped"
        });
        assert.equal(job.txStatus, "complete", "status should be complete")
        await assertElectionState(electionId, "stopped")
    })

    it('should resume election', async () => {
        let job = await nv.SetElectionStatus(electionId, {
            status: "voting"
        });
        assert.equal(job.txStatus, "complete", "status should be complete")
        await assertElectionState(electionId, "voting")
    })

    it('should get an auth token', async ()=> {
        let tok = await publicNv.GetJwtToken(electionId, voterKeys[0])
        assert.equal(tok.token != null, true, "should have a token")
        tokens.push(tok.token);
    })

    it('should cast a vote', async ()=> {
        let job = await publicNv.CastSignedVote(electionId, tokens[0], VOTES.VOTE_0_0_0)
        assert.equal(job.jobId != null, true, "jobId should be present: "+JSON.stringify(job))
        assert.equal(job.txStatus, "pending", "status should be pending")

        let res = await publicNv.PollJob(job.jobId, 60000);
        assert.equal(res.txResult.tx != null, true, "tx should be defined")
        assert.equal(res.txStatus, "complete", "status should be complete")
    })

    it('should stop and close election', async () => {
        let stop = await nv.SetElectionStatus(electionId, {
            status: "stopped"
        });
        assert.equal(stop.txStatus, "complete", "status should be complete")

        let job = await nv.SetElectionStatus(electionId, {
            status: "closed"
        });
        assert.equal(job.jobId != null, true, "jobId should be present")


        // confirm initial job state
        let checkJob = await nv.AdminGetJob(job.jobId);
        assert.equal(checkJob.txStatus, "pending", "should be in pending state")

        // give it one minute to complete
        let finished = await nv.PollJob(job.jobId, 60000);

        assert.equal(finished.txStatus, "complete", "should be in complete state")

        await assertElectionValues(electionId, {electionStatus: "closed", resultsAvailable: true})
    })

    it('should tally correctly', async ()=> {
        //TODO: implement
        let job = await publicNv.GetResults(electionId)
        assert.equal(job.jobId != null, true, "jobId should be present: "+JSON.stringify(job))
        assert.equal(job.txStatus, "pending", "status should be pending")

        let res = await publicNv.PollJob(job.jobId, 60000);
        assert.equal(res.txResult.results != null, true, "results should be defined")
        assert.equal(res.txStatus, "complete", "status should be complete")
    })

})