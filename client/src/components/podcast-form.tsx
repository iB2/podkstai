import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { processText, SpeakerType } from "@/lib/utils/text-processing";
import { generateAudio, mergeAudioChunks, type AudioChunk } from "@/lib/utils/audio-processing";
import { podcastFormSchema } from "@/lib/schemas/podcast";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bold,
  Italic,
  Pilcrow,
  User,
  Info,
  MessageSquare,
  Cog,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { AudioPreview } from "./audio-preview";

type FormValues = z.infer<typeof podcastFormSchema>;

export function PodcastForm() {
  const [conversationPreview, setConversationPreview] = useState<Array<{speaker: string, text: string}>>([]);
  const [characterCount, setCharacterCount] = useState(0);
  const [processingStatus, setProcessingStatus] = useState({
    isProcessing: false,
    currentStep: "Ready to generate",
    progress: 0,
    error: null as string | null,
  });
  const [generatedPodcastId, setGeneratedPodcastId] = useState<number | null>(null);
  const [audioData, setAudioData] = useState<{
    url: string;
    duration: number;
    chunks: number;
    size: number;
  } | null>(null);

  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(podcastFormSchema),
    defaultValues: {
      title: "",
      author: "",
      description: "",
      category: "",
      firstSpeaker: "male",
      secondSpeaker: "female",
      conversationText: "",
    },
  });

  const watchConversationText = form.watch("conversationText");
  const watchFirstSpeaker = form.watch("firstSpeaker");

  // Automatically set second speaker based on first speaker selection
  useEffect(() => {
    // If first speaker is male, set second speaker to female and vice versa
    const oppositeVoice = watchFirstSpeaker === "male" ? "female" : "male";
    form.setValue("secondSpeaker", oppositeVoice);
  }, [watchFirstSpeaker, form]);

  // Update preview when conversation text changes
  useEffect(() => {
    if (watchConversationText) {
      try {
        const previewLines = watchConversationText
          .split("\n")
          .filter(line => line.trim())
          .map(line => {
            const [speaker, ...rest] = line.split(":");
            if (!rest.length) return { speaker: "Unknown", text: line };
            return { speaker: speaker.trim(), text: rest.join(":").trim() };
          });
        
        setConversationPreview(previewLines);
        setCharacterCount(watchConversationText.length);
      } catch (error) {
        console.error("Error parsing conversation:", error);
      }
    } else {
      setConversationPreview([]);
      setCharacterCount(0);
    }
  }, [watchConversationText]);

  // Mutation for generating podcast
  const generatePodcastMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Step 1: Process the conversation text into chunks
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Processing text...",
        progress: 5,
        error: null,
      });

      // Process text into chunks (2000 chars max)
      // to avoid "MultiSpeakerMarkup is too long" errors from the TTS API
      const chunks = processText(data.conversationText, {
        firstSpeaker: data.firstSpeaker as SpeakerType,
        secondSpeaker: data.secondSpeaker as SpeakerType,
        maxChunkSize: 2000, // Increased from 500 to 2000 as requested
      });

      if (!chunks.length) {
        throw new Error("No valid conversation chunks could be extracted from the text");
      }

      // Step 2: Generate audio for each chunk
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Generating audio...",
        progress: 20,
        error: null,
      });

      const audioChunks: AudioChunk[] = [];
      let totalProgress = 20;
      const progressPerChunk = 60 / chunks.length;

      // Process each chunk one by one
      for (let i = 0; i < chunks.length; i++) {
        setProcessingStatus({
          isProcessing: true,
          currentStep: `Generating audio for chunk ${i + 1} of ${chunks.length}...`,
          progress: totalProgress,
          error: null,
        });

        const chunk = chunks[i];
        try {
          const audioChunk = await generateAudio(chunk);
          audioChunks.push(audioChunk);
          
          totalProgress += progressPerChunk;
          setProcessingStatus({
            isProcessing: true,
            currentStep: `Processed chunk ${i + 1} of ${chunks.length}...`,
            progress: totalProgress,
            error: null,
          });
        } catch (error) {
          console.error(`Error generating audio for chunk ${i}:`, error);
          // We'll continue with other chunks even if one fails
        }
      }

      if (audioChunks.length === 0) {
        throw new Error("Failed to generate any audio chunks");
      }

      // Step 3: Merge audio chunks (or use first chunk if only one exists)
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Preparing final audio...",
        progress: 80,
        error: null,
      });

      // We'll have to create podcast entry first, then merge audio with the podcast ID
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Creating podcast entry...",
        progress: 82,
        error: null,
      });
      
      // First create a temporary podcast record - we'll update it with the merged audio later
      const tempPodcastData = {
        title: data.title,
        author: data.author,
        description: data.description,
        category: data.category,
        language: 'en',
        audioUrl: audioChunks[0].url, // Temporary URL - will be updated after merging
        duration: Math.round(audioChunks.reduce((sum, chunk) => sum + chunk.duration, 0)),
        chunkCount: audioChunks.length,
        fileSize: audioChunks.reduce((sum, chunk) => sum + chunk.fileSize, 0),
        conversation: data.conversationText,
        metadata: {
          firstSpeaker: data.firstSpeaker,
          secondSpeaker: data.secondSpeaker
        }
      };
      
      const tempPodcast = await apiRequest("POST", "/api/podcasts", tempPodcastData);
      
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Merging audio chunks...",
        progress: 85,
        error: null,
      });
      
      // Now merge the audio chunks with the podcast ID
      const mergedAudio = await mergeAudioChunks(audioChunks, tempPodcast.id);

      // We don't need to create another podcast entry, as the merge process
      // has already updated the podcast record with the merged audio URL.
      // The tempPodcast record is now our final podcast
      const podcast = tempPodcast;
      
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Audio merged successfully!",
        progress: 90,
        error: null,
      });
      
      // Step 5: Save all audio chunks with references to the podcast
      setProcessingStatus({
        isProcessing: true,
        currentStep: "Saving audio chunks...",
        progress: 90,
        error: null,
      });
      
      // Save all audio chunks to the database
      const savedChunks = [];
      
      for (const chunk of audioChunks) {
        try {
          const chunkData = {
            podcastId: podcast.id,
            chunkIndex: chunk.chunkIndex,
            audioUrl: chunk.url,
            duration: Math.round(chunk.duration),
            fileSize: chunk.fileSize,
            text: chunk.text.substring(0, 1000), // Limit text size for database
            speakerMap: JSON.stringify(chunk.speakerMap)
          };
          
          const savedChunk = await apiRequest("POST", "/api/podcast-chunks", chunkData);
          savedChunks.push(savedChunk);
        } catch (error) {
          console.error(`Error saving chunk ${chunk.chunkIndex}:`, error);
          // Continue with other chunks even if one fails
        }
      }
      
      console.log(`Successfully saved ${savedChunks.length} of ${audioChunks.length} audio chunks for podcast ID ${podcast.id}`);

      // Complete the process
      setProcessingStatus({
        isProcessing: false,
        currentStep: "Completed",
        progress: 100,
        error: null,
      });

      // Return podcast data for success handler
      return {
        podcast,
        audioData: {
          url: mergedAudio.url,
          duration: mergedAudio.duration,
          chunks: audioChunks.length,
          size: mergedAudio.size
        }
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/podcasts'] });
      
      // Save both the audio data and podcast ID
      setAudioData(data.audioData);
      setGeneratedPodcastId(data.podcast.id);
      
      toast({
        title: "Podcast generated successfully!",
        description: "Your podcast has been created and is ready to play.",
      });
    },
    onError: (error) => {
      setProcessingStatus({
        isProcessing: false,
        currentStep: "Failed",
        progress: 0,
        error: error.message,
      });
      
      toast({
        title: "Failed to generate podcast",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: FormValues) => {
    generatePodcastMutation.mutate(data);
  };

  const handleReset = () => {
    form.reset();
    setProcessingStatus({
      isProcessing: false,
      currentStep: "Ready to generate",
      progress: 0,
      error: null,
    });
    setAudioData(null);
    setGeneratedPodcastId(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Podcast Metadata Column */}
        <div className="lg:col-span-1">
          <Card className="h-full bg-[#282828] shadow-lg">
            <CardHeader className="border-b border-[#333333]">
              <CardTitle className="flex items-center gap-2">
                <Info className="text-primary" />
                Podcast Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Podcast Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="My Amazing Podcast" 
                            className="bg-[#121212] border-[#333333]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Author Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your Name" 
                            className="bg-[#121212] border-[#333333]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What is your podcast about?" 
                            className="bg-[#121212] border-[#333333] h-32 resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-[#121212] border-[#333333]">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#282828] border-[#333333]">
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="entertainment">Entertainment</SelectItem>
                            <SelectItem value="health">Health & Fitness</SelectItem>
                            <SelectItem value="science">Science</SelectItem>
                            <SelectItem value="society">Society & Culture</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormItem>
                    <FormLabel>Podcast Cover (Optional)</FormLabel>
                    <div className="w-full bg-[#121212] border border-dashed border-[#333333] rounded-md px-4 py-8 text-center cursor-pointer hover:bg-[#1e1e1e] transition">
                      <div className="text-3xl text-gray-400 mb-2">📷</div>
                      <p className="text-sm text-gray-400">Click or drag image here</p>
                    </div>
                  </FormItem>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
        
        {/* Conversation Editor Column */}
        <div className="lg:col-span-2">
          <Card className="mb-6 bg-[#282828] shadow-lg">
            <CardHeader className="border-b border-[#333333]">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="text-primary" />
                Conversation Script
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                {/* Speaker Selection */}
                <div className="mb-6">
                  <FormField
                    control={form.control}
                    name="firstSpeaker"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Speaker Voice</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-[#121212] border-[#333333]">
                              <div className="flex items-center">
                                <div className={`h-8 w-8 rounded-full ${watchFirstSpeaker === "male" ? "bg-blue-500" : "bg-pink-500"} flex items-center justify-center mr-3`}>
                                  <User className="h-4 w-4 text-white" />
                                </div>
                                <SelectValue placeholder="Select voice" />
                              </div>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-[#282828] border-[#333333]">
                            <SelectItem value="male">Man (Default)</SelectItem>
                            <SelectItem value="female">Woman</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs text-gray-400 mt-1">
                          Second speaker will automatically be set to the opposite voice
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Conversation Input Area */}
                <FormField
                  control={form.control}
                  name="conversationText"
                  render={({ field }) => (
                    <FormItem className="mb-6">
                      <FormLabel>
                        Enter your conversation script (format: Speaker: Text)
                      </FormLabel>
                      <div className="bg-[#121212] border border-[#333333] rounded-md overflow-hidden">
                        <div className="border-b border-[#333333] px-4 py-2 flex justify-between">
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-primary h-8 w-8">
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-primary h-8 w-8">
                              <Italic className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-primary h-8 w-8">
                              <Pilcrow className="h-4 w-4" />
                            </Button>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">
                              {characterCount}/2000 characters per chunk
                            </span>
                          </div>
                        </div>
                        <FormControl>
                          <Textarea 
                            placeholder={`Man: Hey, welcome to our podcast about AI technology!\nWoman: Thanks for having me. I'm excited to discuss the latest developments.\nMan: Let's start by talking about machine learning trends this year.`} 
                            className="bg-[#121212] px-4 py-3 text-foreground h-64 focus:outline-none resize-none border-0 rounded-none" 
                            {...field} 
                          />
                        </FormControl>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="border-t border-[#333333] p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button
                            type="button"
                            onClick={form.handleSubmit(onSubmit)}
                            disabled={processingStatus.isProcessing || generatePodcastMutation.isPending}
                            className="flex-1 bg-primary hover:bg-accent text-black font-semibold py-3 px-6 rounded-full transition flex items-center justify-center gap-2"
                          >
                            <Wand2 className="h-4 w-4" />
                            <span>Generate Podcast</span>
                          </Button>
                          
                          <Button
                            type="button"
                            onClick={handleReset}
                            variant="outline"
                            disabled={processingStatus.isProcessing || generatePodcastMutation.isPending}
                            className="flex-1 bg-transparent border border-[#333333] hover:bg-[#252525] text-foreground font-medium py-3 px-6 rounded-full transition flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span>Reset</span>
                          </Button>
                        </div>
                        
                        {/* Processing Status (only shown after Generate is clicked) */}
                        {(processingStatus.isProcessing || processingStatus.error) && (
                          <div className="mt-4 bg-[#121212] rounded-lg p-4 border border-[#333333]">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-gray-300">Processing Status</h4>
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                                {processingStatus.currentStep}
                              </span>
                            </div>
                            
                            <div className="w-full bg-[#333333] rounded-full h-2 mb-4">
                              <div 
                                className="progress-bar h-2 rounded-full" 
                                style={{ width: `${processingStatus.progress}%` }}
                              ></div>
                            </div>
                            
                            {processingStatus.isProcessing && (
                              <div className="text-xs text-gray-400">
                                <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />
                                <span>{processingStatus.currentStep}</span>
                              </div>
                            )}
                            
                            {processingStatus.error && (
                              <div className="text-xs text-red-400">
                                <span>{processingStatus.error}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <FormDescription className="text-xs text-gray-400 mt-2 px-4 pb-4">
                        <Info className="h-3 w-3 inline mr-1" />
                        System will automatically chunk conversations longer than 2000 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Example & Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Example Format</h4>
                    <div className="bg-[#121212] border border-[#333333] rounded-md p-4 text-sm">
                      <>
                        {/* Primary speaker */}
                        <p className={watchFirstSpeaker === "male" ? "text-blue-400 mb-1" : "text-pink-400 mb-1"}>
                          <strong>{watchFirstSpeaker === "male" ? "Man" : "Woman"}:</strong> This is how your script should look.
                        </p>
                        
                        {/* Secondary speaker */}
                        <p className={watchFirstSpeaker === "male" ? "text-pink-400 mb-1" : "text-blue-400 mb-1"}>
                          <strong>{watchFirstSpeaker === "male" ? "Woman" : "Man"}:</strong> Make sure to include the speaker prefix.
                        </p>
                        
                        {/* Primary speaker again */}
                        <p className={watchFirstSpeaker === "male" ? "text-blue-400" : "text-pink-400"}>
                          <strong>{watchFirstSpeaker === "male" ? "Man" : "Woman"}:</strong> The system will match speakers to voices!
                        </p>
                      </>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Conversation Preview</h4>
                    <div className="bg-[#121212] border border-[#333333] rounded-md p-4 h-32 overflow-auto text-sm">
                      {conversationPreview.map((line, index, array) => {
                        // First line gets primary voice (always blue), all different speakers get secondary (pink)
                        // This ensures first speaker in preview is always primary, regardless of name
                        let firstSpeakerName = "";
                        if (array.length > 0) {
                          firstSpeakerName = array[0].speaker.trim();
                        }
                        
                        // First speaker always gets primary voice (blue)
                        const isPrimary = line.speaker.trim() === firstSpeakerName;
                        
                        return (
                          <div key={index} className="conversation-line mb-1 p-1 rounded">
                            <strong className={isPrimary ? 
                              (watchFirstSpeaker === "male" ? "text-blue-400" : "text-pink-400") : 
                              (watchFirstSpeaker === "male" ? "text-pink-400" : "text-blue-400")}>
                              {line.speaker}:
                            </strong> {line.text}
                          </div>
                        );
                      })}
                      {conversationPreview.length === 0 && (
                        <p className="text-gray-500 italic">Your conversation preview will appear here</p>
                      )}
                    </div>
                  </div>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audio Preview Section */}
      {audioData && (
        <AudioPreview 
          audioData={audioData} 
          metadata={{
            title: form.getValues("title"),
            author: form.getValues("author")
          }}
          {...(generatedPodcastId ? { podcastId: generatedPodcastId } : {})}
        />
      )}
    </>
  );
}
