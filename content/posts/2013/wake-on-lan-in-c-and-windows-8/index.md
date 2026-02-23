---
title: "Wake on Lan in C# and Windows 8"
date: 2013-04-21T20:24:00.000+02:00
tags: ["C#", "Network"]
author: "Bruno Garcia"
showToc: false
draft: false
cover:
    image: "Wake-on-Lan-on-Wireshark.png"
    relative: true
    small: true
    hiddenInSingle: true
aliases:
  - /blogger/2013/wake-on-lan-in-c-and-windows-8/
description: "Sending Wake-on-LAN magic packets in C# to remotely power on machines over the network, with Windows 8 considerations."
---

About 8 years ago I was writing scripts to run on a network with over 130.000 computers (of which 5000 I administered).
The scripts ran 24/7, parsing computer's inventory log files, which they sent to a central server. It was possible to detect and fix a whole bunch of issues, most of the time even before a user would notice something was wrong.

Note that most of those computers were running Windows NT 4, including the domain controllers. The task to install application in all those computers and keep their anti-virus signature up-to-date was not as trivial as it is today. There were times we needed to perform tasks on computers that weren't even switched on. And I must admit, back then I was quite proud of the solution I came up with for this particular case. Although it's not my goal to go into details on how I managed to get any of those 5000 computers, spread in 130 different offices, powered-on at any time; I want to write a little about the core of the solution: **Wake on Lan**

Whether to be able to power on your computer at home when you are away, or to manage a corporate network, the ability to switch a computer on out of sending a *magic packet* is at least quite interesting. It does require basic knowledge of computer networks and hardware to understand it, but to make it work, all you need is to know how to find your computer's MAC address. That's all you need to use WoL on a local network. However if you are willing to use it over the Internet, you'll need the IP address of the gateway of which the target computer belongs to, and have that gateway configured to forward the *magic packet* to the private network. The Port number is used in this case (if you use NAT, you'll need it), so that you can forward incoming UDP datagram on that predefined port of your router to an internal network IP address, or even the broadcast address if you'd like.

If the computer is switched off, it's likely the network switch's CAM table won't have an entry to your target computer's MAC address, and once your router forwards the datagram received from the external interface to your internal network, to the specific IP address you defined on the forwarding rule, the network switch will broadcast that to all ports.

You'll find many over-architected implementations of Wake on Lan out there, even in C#. But the fact is that it's really simple thing.

#### Let's see some C# code:

```csharp
using System;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.RegularExpressions;

namespace BrunoGarcia.Net
{
    public sealed class WolManager
    {
        const int _payloadSize = 102;

        public static void SendMagicPacket(string mac, IPEndPoint ipEndPoint)
        {
            var macBytes = PhysicalAddress.Parse(mac).GetAddressBytes();

            var payload = new byte[_payloadSize];
            Buffer.BlockCopy(new byte[] { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF }, 0, payload, 0, 6);
            
            for (int i = 1; i < 17; i++)
                Buffer.BlockCopy(macBytes, 0, payload, 6 * i, 6);

            using (var udp = new UdpClient())
                udp.Send(payload, _payloadSize, ipEndPoint);
        }
    }
}
```

As you can see, it's a fire-and-forget operation, a single UDP datagram. The MAC address of the target machine goes in the payload. As I mentioned before, the port is not really important if you are sending the packet on the same subnet of your target computer (without the need of routing). Port on wikipedia you find to be 7 or 9. However 0 can be used:

![Wake on Lan on Wireshark](Wake-on-Lan-on-Wireshark.png)

```csharp
WolManager.SendMagicPacket("B8-AC-6F-59-56-55", 
    new IPEndPoint(IPAddress.Parse("255.255.255.255"), 0));
```

This is fun, and I've used it to power on my computer at home from the Internet a few times. But now, when I got Windows 8, the fun wasn't quite working.

[This KB from Microsoft](http://support.microsoft.com/kb/2776718) describes the change:

> **Windows 7**: In Windows 7, the default shutdown operation puts the system into classic shutdown (S5) and all devices are put into the lowest power state D3. Wake-On-LAN is not officially supported from S5 in Windows 7. However, some network adapters can be left armed for wake if enough residual power is available. As a result, wake from the S5 state is possible on some systems where enough residual power was supplied to the network adapter even though the system is in S5 and devices are in D3.
>
> **Windows 8**: In Windows 8, the default shutdown behavior puts the system into hybrid shutdown (S4) and all devices are put into D3. Remote Wake-On-LAN from hybrid shutdown (S4) or classic shutdown (S5) is unsupported. Network adapters are explicitly not armed for Wake-On-LAN in both the classic shutdown (S5) and hybrid shutdown (S4) cases because users expect zero power consumption and battery drain in the shutdown state. This behavior removes the possibility of spurious wakes when explicit shutdown was requested. As a result, Wake-On-LAN is only supported from sleep (S3) or hibernate (S4) in Windows 8.

What a bummer. Anyway, not time to give up, right? Digging a bit deeper one understands better the changes, and enabling wake on lan on windows 8 is possible again:

Check out [this post](http://www.pendlebury.biz/win8-wol) from Phil Pendlebury which talks about it.
