package com.husarp.ota.core

import org.junit.Test
import org.junit.Assert.*
import java.io.*

class TransferTest {
    private fun response(bytes: ByteArray, offset: Long = 0, status: Int = if (offset>0) 206 else 200) =
        Response(status,ByteArrayInputStream(bytes.copyOfRange(if (status==206) offset.toInt() else 0,bytes.size)),"https://example.test/releases/v1/manifest.json",if(status==206)offset else null)
    private val embedded = bundle()
    private val changed = bundle("1.0.1",listOf(entry("index.html","changed"),entry("stable.css","style"),entry("nested/extra.js","extra")))
    private fun transport(texts: Map<String,String>, calls: MutableList<Pair<String,Long>> = mutableListOf()) = Transport { url, offset ->
        synchronized(calls) { calls.add(url to offset) }; response(texts.getValue(url.substringAfterLast('/')).toByteArray(),offset)
    }
    private fun texts(m: Manifest = changed) = m.files.associate { it.asset to when(it.path) { "index.html" -> "changed"; "nested/extra.js" -> "extra"; else -> "style" } }
    @Test fun changedNetworkPausesTransferAndConsentResumesPartialBytes() {
        val h=Harness(); val data="x".repeat(100000).toByteArray()
        val m=bundle("1.0.1",listOf(entry("index.html",data.toString(Charsets.UTF_8))))
        val offsets=mutableListOf<Long>(); var unmetered=true
        val t=Transport { _,offset ->
            offsets.add(offset)
            Response(if(offset==0L)200 else 206,object:ByteArrayInputStream(data.copyOfRange(offset.toInt(),data.size)) {
                override fun read(b:ByteArray,off:Int,len:Int):Int {
                    val n=super.read(b,off,len); unmetered=false; return n
                }
            },"https://example.test/manifest.json",if(offset>0)offset else null)
        }
        val settings=UpdateSettings(mobileLimitMb=0,setupAnswered=true)
        expectFailure { Installer(h.root,embedded,t,h.log,beforeDownload={
            require(automaticDownload(settings,"fix",data.size.toLong(),unmetered))
        }).stage(m,embedded,{null},"https://example.test/manifest.json") }
        assertNull(h.engine.snapshot().pending)
        val partial=File(h.root,"staging").walkTopDown().first { it.name.endsWith(".part") }.length()
        assertTrue(partial in 1 until data.size.toLong())
        val staged=Installer(h.root,embedded,t,h.log).stage(m,embedded,{null},"https://example.test/manifest.json")!!
        assertEquals(listOf(0L,partial),offsets)
        assertArrayEquals(data,File(staged,"files/index.html").readBytes())
    }
    @Test fun overlayStoresExactlyChangedFiles() {
        val h=Harness(); val calls=mutableListOf<Pair<String,Long>>()
        val stage=Installer(h.root,embedded,transport(texts(),calls),h.log).stage(changed,embedded,{null},"https://example.test/releases/v1/manifest.json")!!
        assertEquals(setOf("index.html","nested/extra.js"),File(stage,"files").walkTopDown().filter { it.isFile }.map { it.relativeTo(File(stage,"files")).invariantSeparatorsPath }.toSet())
        assertEquals(2,calls.size); assertTrue(calls.all { it.first.startsWith("https://example.test/releases/v1/f-") })
        h.engine.commit(changed,stage); h.engine.coldStart()
        assertEquals("changed",h.engine.overlayFile("index.html")!!.readText()); assertNull(h.engine.overlayFile("stable.css")); assertTrue(h.engine.hasPath("stable.css"))
    }
    @Test fun fileRemovedFromInventoryCannotLeakFromApk() {
        val h=Harness(); val next=changed.copy(files=changed.files.filter { it.path!="stable.css" })
        val stage=Installer(h.root,embedded,transport(texts()),h.log).stage(next,embedded,{null},"https://example.test/manifest.json")!!
        h.engine.commit(next,stage); h.engine.coldStart(); assertFalse(h.engine.hasPath("stable.css"))
    }
    @Test fun emptyOverlayFileIsCreatedAndVerifiedWithoutNetwork() {
        val h = Harness()
        val empty = entry("index.html", "")
        val manifest = bundle("1.0.1", listOf(empty))
        val installer = Installer(h.root, embedded, Transport { _, _ -> error("Must not download") }, h.log)
        val staged = installer.stage(manifest, embedded, { null }, "https://example.test/manifest.json")!!
        h.engine.commit(manifest, staged)
        h.engine.coldStart()
        val file = h.engine.overlayFile(empty.path)!!
        assertTrue(file.isFile)
        assertArrayEquals(ByteArray(0), file.readBytes())
    }
    @Test fun unchangedCurrentOverlayReusedWithoutDownload() {
        val h=Harness(); val t=transport(texts()); val first=Installer(h.root,embedded,t,h.log).stage(changed,embedded,{null},"https://example.test/manifest.json")!!
        h.engine.commit(changed,first); val launch=h.engine.coldStart(); h.engine.ready(launch.version,launch.token)
        val next=changed.copy(version="1.0.2")
        val stage=Installer(h.root,embedded,Transport { _, _ -> error("Must not download") },h.log).stage(next,changed,{h.engine.overlayFile(it)},"https://example.test/manifest.json")!!
        assertEquals("changed",File(stage,"files/index.html").readText()); assertEquals("extra",File(stage,"files/nested/extra.js").readText())
    }
    @Test fun wrongHashDeletesWholeStagingAndLeavesState() {
        val h=Harness(); h.engine.coldStart()
        val corrupt=Transport { _,_ -> response("xxxxxxx".toByteArray()) }
        expectFailure { Installer(h.root,embedded,corrupt,h.log).stage(changed,embedded,{null},"https://example.test/manifest.json") }
        assertEquals(0,File(h.root,"staging").listFiles()!!.size); assertEquals("1.0.0",h.engine.snapshot().current); assertNull(h.engine.snapshot().pending)
    }
    @Test fun oversizedFileDeletesStaging() {
        val h=Harness(); expectFailure { Installer(h.root,embedded,Transport { _,_->response(ByteArray(100)) },h.log).stage(changed,embedded,{null},"https://example.test/manifest.json") }
        assertEquals(0,File(h.root,"staging").listFiles()!!.size)
    }
    @Test fun interruptedAtHalfResumesWithRange() {
        val h=Harness(); val m=bundle("1.0.1",listOf(entry("index.html","abcdefgh")))
        var attempt=0; val offsets=mutableListOf<Long>()
        val t=Transport { _,offset ->
            offsets.add(offset); attempt++
            if (attempt==1) Response(200,object:InputStream() {
                var used=false
                override fun read():Int = throw IOException("cut")
                override fun read(b:ByteArray,off:Int,len:Int):Int {
                    if(used)throw IOException("cut at 50%"); used=true; "abcd".toByteArray().copyInto(b,off); return 4
                }
            },"https://example.test/manifest.json") else response("abcdefgh".toByteArray(),offset)
        }
        val progress = mutableListOf<Triple<Long, Long, Long>>()
        val installer=Installer(h.root,embedded,t,h.log, transferProgress = { done, total, received ->
            progress.add(Triple(done, total, received))
        })
        expectFailure { installer.stage(m,embedded,{null},"https://example.test/manifest.json") }
        assertEquals(4,File(h.root,"staging").walkTopDown().first { it.name.endsWith(".part") }.length())
        val stage=installer.stage(m,embedded,{null},"https://example.test/manifest.json")!!
        assertEquals(listOf(0L,4L),offsets); assertEquals("abcdefgh",File(stage,"files/index.html").readText())
        assertEquals(Triple(8L, 8L, 4L), progress.last())
    }
    @Test fun serverIgnoringRangeSafelyRestartsFile() {
        val h=Harness(); val m=bundle("1.0.1",listOf(entry("index.html","abcdefgh"))); var attempt=0
        val t=Transport { _,offset -> attempt++; response((if(attempt==1)"abcd" else "abcdefgh").toByteArray(),0,200) }
        val installer=Installer(h.root,embedded,t,h.log); expectFailure { installer.stage(m,embedded,{null},"https://example.test/manifest.json") }
        val stage=installer.stage(m,embedded,{null},"https://example.test/manifest.json")!!
        assertEquals("abcdefgh",File(stage,"files/index.html").readText())
    }
    @Test fun incorrectRangeRejected() {
        val h=Harness(); expectFailure { Installer(h.root,embedded,Transport { _,_->Response(206,ByteArrayInputStream("changed".toByteArray()),"https://example.test/manifest.json",4) },h.log).stage(changed,embedded,{null},"https://example.test/manifest.json") }
        assertEquals(0,File(h.root,"staging").listFiles()!!.size)
    }
    @Test fun completedFileReusedAfterSecondFileNetworkFailure() {
        val h=Harness(); var firstCalls=0; var secondCalls=0
        val firstDone=java.util.concurrent.CountDownLatch(1)
        val firstAsset=changed.files.first().asset
        val t=Transport { url,offset -> if(url.endsWith(firstAsset)) {firstCalls++;response("changed".toByteArray(),offset)} else {secondCalls++;if(secondCalls==1) { check(firstDone.await(5,java.util.concurrent.TimeUnit.SECONDS)); throw IOException("offline") };response("extra".toByteArray(),offset)} }
        val installer=Installer(h.root,embedded,t,h.log,progress={ if(it.startsWith("File downloaded index.html:")) firstDone.countDown() }); expectFailure { installer.stage(changed,embedded,{null},"https://example.test/manifest.json") }
        installer.stage(changed,embedded,{null},"https://example.test/manifest.json"); assertEquals(1,firstCalls); assertEquals(2,secondCalls)
    }
    @Test fun storageLowSkipsWithoutNetworkOrStateChange() {
        val h=Harness(); val result=Installer(h.root,embedded,Transport { _,_->error("No network") },h.log,available={0}).stage(changed,embedded,{null},"https://example.test/manifest.json")
        assertNull(result); assertNull(h.engine.snapshot().pending)
    }
    @Test fun exactTwoTimesBundleSpaceAccepted() {
        val h=Harness(); assertNotNull(Installer(h.root,embedded,transport(texts()),h.log,available={changed.files.sumOf{it.size}*2}).stage(changed,embedded,{null},"https://example.test/manifest.json"))
    }
    @Test fun offlineNeverChangesActiveState() {
        val h=Harness(); h.engine.coldStart(); val before=h.engine.stateJson()
        expectFailure { fetchManifest("https://example.test/manifest.json",Transport { _,_->throw IOException("offline") },h.log) }; assertEquals(before,h.engine.stateJson())
    }
    @Test fun manifest404IsSuccessfulAbsenceWithoutChangingState() {
        val h=Harness(); h.engine.coldStart(); val before=h.engine.stateJson()
        // Production HTTPS transport reports HTTP errors with their status code.
        val result=fetchManifest("https://example.test/manifest.json",Transport { _,_->throw HttpStatusException(404) },h.log)
        assertNull(result); assertEquals(before,h.engine.stateJson())
        assertTrue(h.log.read().contains("Manifest not found (HTTP 404): no update published"))
    }
    @Test fun manifest404ResponseClosesWithoutReadingBody() {
        var closed=false
        val body=object:InputStream() {
            override fun read():Int = error("404 body must not be read")
            override fun close() { closed=true }
        }
        assertNull(fetchManifest("https://example.test/manifest.json",Transport { _,_->Response(404,body,"https://example.test/manifest.json") },Harness().log))
        assertTrue(closed)
    }
    @Test fun otherManifestHttpErrorsRemainFailures() {
        for (status in listOf(403,410,500,503)) {
            val h=Harness()
            expectFailure { fetchManifest("https://example.test/manifest.json",Transport { _,_->throw HttpStatusException(status) },h.log) }
            assertFalse(h.log.read().contains("no update published"))
        }
    }
    @Test fun oversizedManifestRejected() { expectFailure { fetchManifest("https://example.test/manifest.json",Transport { _,_->response(ByteArray(2*1024*1024+1)) },Harness().log) } }
    @Test fun manifestCarriesFinalReleaseUrlForPinnedAssets() {
        val result=fetchManifest("https://example.test/latest/manifest.json",Transport { _,_->response("{}".toByteArray()) },Harness().log)
        assertEquals("https://example.test/releases/v1/manifest.json",result!!.finalUrl)
    }
    @Test fun insecureNetworkUrlRefusedBeforeConnecting() { expectFailure { HttpsTransport().open("http://example.test/manifest.json",0) } }
    @Test fun stageWithoutCommitNeverChangesLaunchEvenAfterReboot() {
        val h=Harness(); h.engine.coldStart(); Installer(h.root,embedded,transport(texts()),h.log).stage(changed,embedded,{null},"https://example.test/manifest.json")
        assertEquals("1.0.0",Harness(h.root).engine.coldStart().version)
    }
    @Test fun githubCdnRedirectRetainsTaggedReleaseAssetBase() {
        val canonical="https://github.com/example/ota/releases/download/v1.0.1/manifest.json"
        val url=assetManifestUrl(listOf("https://github.com/example/ota/releases/latest/download/manifest.json",canonical,"https://release-assets.githubusercontent.com/uuid?signature=abc"))
        assertEquals(canonical,url)
        assertEquals("https://github.com/example/ota/releases/download/v1.0.1/f-hash.bin",java.net.URI(url).resolve("f-hash.bin").toString())
    }
    @Test fun githubLatestCannotUseUnpinnedCdnSiblingPaths() {
        expectFailure { assetManifestUrl(listOf("https://github.com/example/ota/releases/latest/download/manifest.json","https://release-assets.githubusercontent.com/uuid")) }
    }
    @Test fun customStaticHttpsSourceUsesFinalManifestDirectory() {
        assertEquals("https://cdn.example.test/v1/manifest.json",assetManifestUrl(listOf("https://example.test/manifest.json","https://cdn.example.test/v1/manifest.json")))
    }
    @Test fun changedFilesDownloadConcurrentlyWithAtMostFourOpenResponses() {
        val h=Harness()
        val data=(1..9).associate { "nested/file$it.js" to "payload-$it" }
        val m=bundle("1.0.1",data.map { entry(it.key,it.value) })
        val byAsset=m.files.associate { it.asset to data.getValue(it.path).toByteArray() }
        val firstFour=java.util.concurrent.CountDownLatch(4)
        val active=java.util.concurrent.atomic.AtomicInteger()
        val peak=java.util.concurrent.atomic.AtomicInteger()
        val calls=java.util.concurrent.atomic.AtomicInteger()
        val t=Transport { url,offset ->
            assertEquals(0L,offset)
            val n=active.incrementAndGet(); peak.updateAndGet { maxOf(it,n) }
            if(calls.incrementAndGet()<=4) {
                firstFour.countDown()
                check(firstFour.await(5,java.util.concurrent.TimeUnit.SECONDS)) { "Files were downloaded serially" }
            }
            Response(200,ByteArrayInputStream(byAsset.getValue(url.substringAfterLast('/'))),url) { active.decrementAndGet() }
        }
        val stage=Installer(h.root,embedded,t,h.log).stage(m,embedded,{null},"https://example.test/manifest.json")!!
        assertEquals(4,peak.get()); assertEquals(0,active.get()); assertEquals(9,calls.get())
        for(f in m.files) assertEquals(f.sha256,hash(File(stage,"files/${f.path}")))
        assertTrue(File(stage,"bundle.json").isFile)
        assertNull(h.engine.snapshot().pending)
        assertEquals(9,h.log.read().lines().count { it.contains("File downloaded ") && it.contains("KB/s") })
    }

    @Test fun fixedChannelWithConfiguredMetadataNameRetainsGithubPayloadBase() {
        val canonical="https://github.com/example/app/releases/download/android-channel/app-channel.json"
        val url=assetManifestUrl(listOf(canonical,"https://release-assets.githubusercontent.com/uuid?signature=abc"))
        assertEquals(canonical,url)
        assertEquals("https://github.com/example/app/releases/download/android-channel/chunk-hash.dat",java.net.URI(url).resolve("chunk-hash.dat").toString())
    }
}
