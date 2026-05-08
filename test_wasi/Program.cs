using System;
class Program {
    static void Main(string[] args) {
        Console.WriteLine("args.Length: " + args.Length);
        Console.WriteLine("Env args.Length: " + Environment.GetCommandLineArgs().Length);
        foreach (var a in args) Console.WriteLine("arg: " + a);
    }
}
